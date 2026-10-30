import asyncio
import base64
import re
import time
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import httpx
from markdownify import markdownify as md

from scrape.browserManager import browserManagerInstance
from scrape.security import SsrfValidationError, validateTargetUrl

# Common headers to avoid naive bot detection
standardHeaders = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}


def isSpaOrBlocked(rawHtml: str, statusCode: int) -> bool:
    """Detects if an HTML page is a dynamic client-rendered SPA shell
    or blocked by a bot challenge, requiring a real browser.
    """
    if statusCode in (403, 429, 503):
        return True

    soup = BeautifulSoup(rawHtml, "html.parser")

    # Check for common bot challenge signatures
    if "challenge-platform" in rawHtml or "cf-browser-verification" in rawHtml:
        return True

    # Check for empty SPA mounting targets (<div id="app"></div>, <div id="root"></div>)
    commonMountIds = ["app", "root", "__next", "__nuxt"]
    for mountId in commonMountIds:
        mountElement = soup.find(id=mountId)
        if mountElement is not None and len(mountElement.get_text(strip=True)) == 0:
            return True

    # If body text length is suspiciously tiny (< 100 chars) but has script tags, likely an SPA
    bodyElement = soup.body or soup
    bodyTextLength = len(bodyElement.get_text(strip=True))
    hasScripts = len(soup.find_all("script")) > 0
    if bodyTextLength < 100 and hasScripts:
        return True

    return False


def extractPageDetails(rawHtml: str, pageUrl: str) -> dict:
    """Helper to extract metadata, links, and markdown from an HTML string."""
    soup = BeautifulSoup(rawHtml, "html.parser")

    # 1. Metadata
    title = soup.title.get_text(strip=True) if soup.title else ""
    descTag = soup.find("meta", attrs={"name": "description"}) or soup.find(
        "meta", attrs={"property": "og:description"}
    )
    description = descTag.get("content", "").strip() if descTag else ""

    # 2. Links
    linksList = []
    for anchorTag in soup.find_all("a", href=True):
        hrefValue = anchorTag["href"].strip()
        if hrefValue and not hrefValue.startswith(("javascript:", "mailto:", "tel:", "#")):
            absoluteUrl = urljoin(pageUrl, hrefValue)
            if absoluteUrl not in linksList:
                linksList.append(absoluteUrl)

    # 3. Clean Markdown
    contentSoup = BeautifulSoup(rawHtml, "html.parser")
    for unnecessaryTag in contentSoup(["script", "style", "noscript", "svg"]):
        unnecessaryTag.decompose()

    bodyElement = contentSoup.body or contentSoup
    cleanMarkdown = md(
        str(bodyElement),
        heading_style="ATX",
        strip=["script", "style"],
    )
    cleanMarkdown = re.sub(r"\n{3,}", "\n\n", cleanMarkdown).strip()

    return {
        "title": title,
        "description": description,
        "links": linksList,
        "markdown": cleanMarkdown,
        "cleanedHtml": str(bodyElement),
    }


async def validateResponseRedirect(response: httpx.Response) -> None:
    """Validates HTTP redirects to prevent SSRF via redirect to internal IP addresses."""
    if response.is_redirect:
        redirectHeader = response.headers.get("location")
        if redirectHeader:
            resolvedRedirectUrl = urljoin(str(response.url), redirectHeader)
            validateTargetUrl(resolvedRedirectUrl)


async def scrapeHttp(url: str, timeoutMs: int = 15000) -> dict | None:
    """Fast static fetcher using HTTP client.
    Returns parsed dictionary or None if dynamic rendering is required.
    """
    validateTargetUrl(url)
    timeoutSeconds = timeoutMs / 1000.0
    try:
        async with httpx.AsyncClient(
            headers=standardHeaders,
            follow_redirects=True,
            event_hooks={"response": [validateResponseRedirect]},
        ) as httpClient:
            response = await httpClient.get(url, timeout=timeoutSeconds)
            statusCode = response.status_code
            rawHtml = response.text

            # If dynamic rendering is required, hand over to browser
            if isSpaOrBlocked(rawHtml, statusCode):
                return None

            pageDetails = extractPageDetails(rawHtml, url)
            return {
                "statusCode": statusCode,
                "rawHtml": rawHtml,
                "title": pageDetails["title"],
                "description": pageDetails["description"],
                "links": pageDetails["links"],
                "markdown": pageDetails["markdown"],
                "cleanedHtml": pageDetails["cleanedHtml"],
                "screenshot": None,
                "engineUsed": "http",
            }
    except SsrfValidationError:
        raise
    except Exception:
        # Any network or SSL error with static client hands over to browser
        return None


async def scrapeBrowser(
    url: str,
    waitForSelector: str | None = None,
    timeoutMs: int = 30000,
    captureScreenshot: bool = False,
) -> dict:
    """Dynamic browser fetcher using warm Playwright Chromium."""
    validateTargetUrl(url)
    incognitoContext = await browserManagerInstance.createIncognitoContext()
    page = await incognitoContext.new_page()
    screenshotBase64 = None

    try:
        response = await page.goto(
            url,
            wait_until="networkidle",
            timeout=timeoutMs,
        )
        statusCode = response.status if response else 200

        if waitForSelector:
            await page.wait_for_selector(waitForSelector, timeout=5000)
        else:
            await page.wait_for_timeout(1000)

        if captureScreenshot:
            screenshotBytes = await page.screenshot(full_page=False)
            screenshotBase64 = base64.b64encode(screenshotBytes).decode("utf-8")

        rawHtml = await page.content()
    finally:
        await browserManagerInstance.releaseContext(incognitoContext)

    pageDetails = extractPageDetails(rawHtml, url)

    return {
        "statusCode": statusCode,
        "rawHtml": rawHtml,
        "title": pageDetails["title"],
        "description": pageDetails["description"],
        "links": pageDetails["links"],
        "markdown": pageDetails["markdown"],
        "cleanedHtml": pageDetails["cleanedHtml"],
        "screenshot": screenshotBase64,
        "engineUsed": "browser",
    }


async def scrapeUrl(
    url: str,
    mode: str = "auto",
    formats: list[str] | None = None,
    waitForSelector: str | None = None,
    timeoutMs: int = 30000,
) -> dict:
    """Unified scrape entrypoint matching Firecrawl functionality:
    - mode: 'auto' (fast HTTP with browser fallback), 'http', or 'browser'
    - formats: ['markdown', 'html', 'rawHtml', 'links', 'screenshot']
    """
    # Validate target URL upfront against SSRF threats before initiating any network connections
    validateTargetUrl(url)

    startTime = time.time()

    if formats is None:
        formats = ["markdown", "links"]

    needsScreenshot = "screenshot" in formats
    scrapeOutput = None

    try:
        if mode == "http":
            scrapeOutput = await scrapeHttp(url, timeoutMs=timeoutMs)
            if scrapeOutput is None:
                raise RuntimeError("Static HTTP scrape failed or page requires JavaScript.")

        elif mode == "browser" or needsScreenshot:
            scrapeOutput = await scrapeBrowser(
                url=url,
                waitForSelector=waitForSelector,
                timeoutMs=timeoutMs,
                captureScreenshot=needsScreenshot,
            )

        else:  # mode == "auto"
            scrapeOutput = await scrapeHttp(url, timeoutMs=10000)
            if scrapeOutput is None:
                scrapeOutput = await scrapeBrowser(
                    url=url,
                    waitForSelector=waitForSelector,
                    timeoutMs=timeoutMs,
                    captureScreenshot=needsScreenshot,
                )

        executionDurationMs = round((time.time() - startTime) * 1000, 2)

        # Filter the response data based on requested formats
        responseData = {
            "metadata": {
                "title": scrapeOutput["title"],
                "description": scrapeOutput["description"],
                "statusCode": scrapeOutput["statusCode"],
                "url": url,
                "engineUsed": scrapeOutput["engineUsed"],
                "durationMs": executionDurationMs,
            }
        }

        if "markdown" in formats:
            responseData["markdown"] = scrapeOutput["markdown"]
        if "html" in formats:
            responseData["html"] = scrapeOutput["cleanedHtml"]
        if "rawHtml" in formats:
            responseData["rawHtml"] = scrapeOutput["rawHtml"]
        if "links" in formats:
            responseData["links"] = scrapeOutput["links"]
        if "screenshot" in formats:
            responseData["screenshot"] = scrapeOutput["screenshot"]

        return {
            "success": True,
            "data": responseData,
            "metrics": {
                "durationMs": executionDurationMs,
            },
            "error": None,
        }

    except SsrfValidationError:
        raise
    except Exception as errorOccurred:
        executionDurationMs = round((time.time() - startTime) * 1000, 2)
        return {
            "success": False,
            "data": None,
            "metrics": {
                "durationMs": executionDurationMs,
            },
            "error": str(errorOccurred),
        }


if __name__ == "__main__":
    import sys

    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    async def runTest() -> None:
        # Test 1: Static website (should resolve via fast HTTP in <0.5s)
        staticTargetUrl = "https://example.com"
        print(f"1. Testing Static Site ('auto' mode): {staticTargetUrl}")
        startStatic = time.time()
        staticResult = await scrapeUrl(staticTargetUrl, mode="auto", formats=["markdown", "links"])
        staticDuration = time.time() - startStatic
        print(f"   Engine: {staticResult['data']['metadata']['engineUsed']} | Duration: {staticDuration:.2f}s")
        print(f"   Title: {staticResult['data']['metadata']['title']}")

        # Test 2: Dynamic SPA website (should automatically detect SPA and fallback to browser)
        spaTargetUrl = "https://zerodaily.in"
        print(f"\n2. Testing Dynamic SPA ('auto' mode fallback): {spaTargetUrl}")
        startSpa = time.time()
        spaResult = await scrapeUrl(spaTargetUrl, mode="auto", formats=["markdown", "screenshot"])
        spaDuration = time.time() - startSpa
        print(f"   Engine: {spaResult['data']['metadata']['engineUsed']} | Duration: {spaDuration:.2f}s")
        print(f"   Title: {spaResult['data']['metadata']['title']}")
        print(f"   Screenshot captured: {'Yes' if spaResult['data'].get('screenshot') else 'No'}")

        await browserManagerInstance.closeBrowser()

    asyncio.run(runTest())
