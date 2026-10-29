import asyncio
from playwright.async_api import Browser, BrowserContext, Playwright, async_playwright


class BrowserManager:
    """Singleton manager that keeps a warm Chromium browser alive in memory,
    creating and destroying lightweight isolated contexts per scrape.
    """

    def __init__(self) -> None:
        self.playwrightInstance: Playwright | None = None
        self.browserInstance: Browser | None = None
        self.initializationLock: asyncio.Lock = asyncio.Lock()
        self.processedRequestCount: int = 0
        self.maxRequestsBeforeRecycle: int = 150

    async def getBrowser(self) -> Browser:
        """Returns the active warm browser instance, launching it lazily if not running."""
        async with self.initializationLock:
            isBrowserAlive = self.browserInstance and self.browserInstance.is_connected()
            if not isBrowserAlive:
                if self.playwrightInstance is None:
                    self.playwrightInstance = await async_playwright().start()

                self.browserInstance = await self.playwrightInstance.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--no-first-run",
                        "--no-zygote",
                    ],
                )
                self.processedRequestCount = 0

            return self.browserInstance

    async def createIncognitoContext(self) -> BrowserContext:
        """Creates a fresh, isolated incognito browser context for a scrape request."""
        activeBrowser = await self.getBrowser()
        incognitoContext = await activeBrowser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1,
        )
        return incognitoContext

    async def releaseContext(self, contextToClose: BrowserContext) -> None:
        """Closes the ephemeral context and recycles the browser if request threshold is reached."""
        try:
            await contextToClose.close()
        except Exception:
            pass

        self.processedRequestCount += 1

        # Periodic recycle to guarantee zero memory accumulation
        if self.processedRequestCount >= self.maxRequestsBeforeRecycle:
            await self.recycleBrowser()

    async def recycleBrowser(self) -> None:
        """Restarts Chromium smoothly when request threshold is reached."""
        async with self.initializationLock:
            if self.browserInstance and self.browserInstance.is_connected():
                await self.browserInstance.close()
            self.browserInstance = None
            self.processedRequestCount = 0

    async def closeBrowser(self) -> None:
        """Graceful shutdown for the entire browser engine."""
        async with self.initializationLock:
            if self.browserInstance and self.browserInstance.is_connected():
                await self.browserInstance.close()
                self.browserInstance = None

            if self.playwrightInstance:
                await self.playwrightInstance.stop()
                self.playwrightInstance = None


# Shared global singleton instance
browserManagerInstance = BrowserManager()
