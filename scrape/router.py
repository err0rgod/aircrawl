from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from scrape.scrape import scrapeUrl
from scrape.security import SsrfValidationError

scrapeRouter = APIRouter(prefix="/v1/scrape", tags=["Scrape"])


class ScrapeRequest(BaseModel):
    """Request payload schema for scraping a specific webpage."""

    url: str = Field(
        ...,
        description="The target URL to scrape.",
        examples=["https://zerodaily.in"],
    )
    mode: str = Field(
        default="auto",
        description="Rendering mode: 'auto' (HTTP with browser fallback), 'http' (fast static), or 'browser' (Playwright).",
    )
    formats: list[str] = Field(
        default=["markdown", "links"],
        description="Desired output formats: 'markdown', 'html', 'rawHtml', 'links', 'screenshot'.",
    )
    waitForSelector: str | None = Field(
        default=None,
        description="Optional CSS selector to wait for before extracting page content (browser mode only).",
    )
    timeoutMs: int = Field(
        default=30000,
        ge=1000,
        le=120000,
        description="Navigation and rendering timeout in milliseconds.",
    )


@scrapeRouter.post(
    "",
    summary="Scrape a Webpage",
    description="Fetches a webpage, renders dynamic JS if required, and returns clean Markdown, HTML, links, or screenshots.",
)
async def performScrape(scrapeRequest: ScrapeRequest) -> dict:
    """Handles page scraping requests and returns standardized markdown and metadata."""
    try:
        scrapeResult = await scrapeUrl(
            url=scrapeRequest.url,
            mode=scrapeRequest.mode,
            formats=scrapeRequest.formats,
            waitForSelector=scrapeRequest.waitForSelector,
            timeoutMs=scrapeRequest.timeoutMs,
        )

        if not scrapeResult["success"]:
            raise HTTPException(status_code=500, detail=scrapeResult["error"])

        return scrapeResult
    except SsrfValidationError as ssrfError:
        raise HTTPException(status_code=400, detail=str(ssrfError))
