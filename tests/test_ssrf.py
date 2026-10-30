import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from scrape.security import SsrfValidationError, validateTargetUrl


def testPrivateIpValidation() -> None:
    """Verifies that validateTargetUrl rejects private IPv4 and loopback addresses."""
    privateTestUrls = [
        "http://127.0.0.1:8000/",
        "http://localhost:8080/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://127.0.0.2:9000/admin",
        "http://[::1]:8080/",
    ]
    for targetUrl in privateTestUrls:
        with pytest.raises(SsrfValidationError):
            validateTargetUrl(targetUrl)


def testCloudMetadataValidation() -> None:
    """Verifies that validateTargetUrl blocks cloud metadata endpoints (e.g. AWS EC2 169.254.169.254)."""
    cloudMetadataUrls = [
        "http://169.254.169.254/latest/meta-data/",
        "http://169.254.169.254/latest/user-data",
        "http://169.254.169.254/computeMetadata/v1/",
        "http://[fe80::1]/metadata",
    ]
    for targetUrl in cloudMetadataUrls:
        with pytest.raises(SsrfValidationError):
            validateTargetUrl(targetUrl)


def testInvalidSchemesValidation() -> None:
    """Verifies that non-http/https URL schemes are rejected."""
    invalidSchemeUrls = [
        "file:///etc/passwd",
        "ftp://example.com/test",
        "gopher://127.0.0.1:70/",
        "data:text/html,<script>alert(1)</script>",
        "ldap://localhost:389/dc=example,dc=com",
    ]
    for targetUrl in invalidSchemeUrls:
        with pytest.raises(SsrfValidationError) as errorInfo:
            validateTargetUrl(targetUrl)
        assert "Only 'http' and 'https' are allowed" in str(errorInfo.value)


def testSpecialHostnamesValidation() -> None:
    """Verifies that special internal domains without public DNS are rejected."""
    internalHostnames = [
        "http://db.internal/",
        "http://cache.local/",
        "http://app.localhost/",
        "http://worker.internal:5000/status",
    ]
    for targetUrl in internalHostnames:
        with pytest.raises(SsrfValidationError):
            validateTargetUrl(targetUrl)


def testValidPublicUrlValidation() -> None:
    """Verifies that legitimate public URLs pass validation without error."""
    # Should resolve to public IP and not raise any exception
    validateTargetUrl("https://example.com")
    validateTargetUrl("http://example.com/test")


@pytest.mark.asyncio
async def testScrapeEndpointSsrfRejection() -> None:
    """Verifies that /v1/scrape returns 400 Bad Request with descriptive error for SSRF attempts."""
    blockedTargetUrls = [
        "http://127.0.0.1:8000/",
        "http://localhost:8080/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "file:///etc/passwd",
        "ftp://example.com/test",
    ]
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as testClient:
        for blockedUrl in blockedTargetUrls:
            response = await testClient.post(
                "/v1/scrape",
                json={"url": blockedUrl},
            )
            assert response.status_code == 400, f"Expected 400 for {blockedUrl}, got {response.status_code}"
            responseJson = response.json()
            assert "detail" in responseJson
            assert len(responseJson["detail"]) > 0


@pytest.mark.asyncio
async def testParseEndpointSsrfRejection() -> None:
    """Verifies that /v1/parse returns 400 Bad Request with descriptive error when given an SSRF target URL."""
    blockedTargetUrls = [
        "http://127.0.0.1:8000/",
        "http://localhost:8080/",
        "http://169.254.169.254/latest/meta-data/",
        "file:///etc/passwd",
    ]
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as testClient:
        for blockedUrl in blockedTargetUrls:
            response = await testClient.post(
                "/v1/parse",
                json={
                    "url": blockedUrl,
                    "prompt": "Extract sensitive configuration",
                },
            )
            assert response.status_code == 400, f"Expected 400 for {blockedUrl}, got {response.status_code}"
            responseJson = response.json()
            assert "detail" in responseJson
            assert len(responseJson["detail"]) > 0


@pytest.mark.asyncio
async def testRedirectSsrfProtection() -> None:
    """Verifies that HTTP redirects pointing to internal IP addresses are caught and blocked."""
    import httpx
    from scrape.scrape import validateResponseRedirect

    mockRedirectResponse = httpx.Response(
        status_code=302,
        headers={"location": "http://169.254.169.254/latest/meta-data/"},
        request=httpx.Request("GET", "https://example.com/redirect"),
    )
    with pytest.raises(SsrfValidationError) as errorInfo:
        await validateResponseRedirect(mockRedirectResponse)

    assert "restricted or private IP address" in str(errorInfo.value)
