import asyncio
import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from scrape.scrape import extractPageDetails, isSpaOrBlocked


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def testHealthEndpoint():
    """Verifies that the /health endpoint returns 200 OK and expected status."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as testClient:
        response = await testClient.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "search" in data["activeModules"]
        assert "scrape" in data["activeModules"]


@pytest.mark.asyncio
async def testFrontendRoot():
    """Verifies that the frontend static UI is served at root /."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as testClient:
        response = await testClient.get("/")
        assert response.status_code == 200
        assert "<!DOCTYPE html>" in response.text
        assert "AirCrawl" in response.text


def testSpaDetectionHelper():
    """Verifies the heuristic SPA shell detection function."""
    spaHtml = '<!DOCTYPE html><html><body><div id="app"></div><script src="/main.js"></script></body></html>'
    staticHtml = '<!DOCTYPE html><html><body><h1>Hello World</h1><p>This is a standard content page with full sentences.</p></body></html>'

    assert isSpaOrBlocked(spaHtml, 200) is True
    assert isSpaOrBlocked(staticHtml, 200) is False
    assert isSpaOrBlocked("Blocked", 403) is True


def testPageDetailsExtraction():
    """Verifies that extractPageDetails accurately extracts title, markdown, and links."""
    sampleHtml = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>AirCrawl Test Title</title>
        <meta name="description" content="Test description text">
      </head>
      <body>
        <h1>Main Header</h1>
        <p>This is a paragraph with a <a href="/subpage">link</a>.</p>
        <script>console.log("noisy script");</script>
      </body>
    </html>
    """
    extractedData = extractPageDetails(sampleHtml, "https://example.com")

    assert extractedData["title"] == "AirCrawl Test Title"
    assert extractedData["description"] == "Test description text"
    assert "https://example.com/subpage" in extractedData["links"]
    assert "Main Header" in extractedData["markdown"]
    assert "noisy script" not in extractedData["markdown"]


@pytest.mark.asyncio
async def testScrapeEndpointStatic():
    """Verifies that /v1/scrape fetches static pages and includes execution time metrics."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as testClient:
        response = await testClient.post(
            "/v1/scrape",
            json={
                "url": "https://example.com",
                "mode": "http",
                "formats": ["markdown", "links"],
            },
        )
        assert response.status_code == 200
        responseData = response.json()
        assert responseData["success"] is True
        assert "metadata" in responseData["data"]
        assert "markdown" in responseData["data"]
        assert "metrics" in responseData
        assert responseData["metrics"]["durationMs"] > 0
        assert "X-Response-Time" in response.headers
