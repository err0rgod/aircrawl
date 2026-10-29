from contextlib import asynccontextmanager
import time
from typing import AsyncGenerator
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from scrape.browserManager import browserManagerInstance
from scrape.router import scrapeRouter
from search.router import searchRouter


@asynccontextmanager
async def appLifespan(appInstance: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup and graceful shutdown tasks."""
    print("AirCrawl API initialized. Services ready.")
    yield
    print("Shutting down AirCrawl API... Closing warm browser instance.")
    await browserManagerInstance.closeBrowser()
    print("AirCrawl API shutdown complete.")


app = FastAPI(
    title="AirCrawl API",
    description=(
        "Production-ready Firecrawl alternative providing 6 core functions: "
        "Search, Scrape, Interact, Parse, Crawl & Monitor."
    ),
    version="1.0.0",
    lifespan=appLifespan,
)

# Enable CORS for web apps and agents
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def addExecutionTimeHeader(request: Request, callNext) -> Response:
    """Middleware that measures total HTTP request processing time and adds an X-Response-Time header."""
    requestStartTime = time.time()
    response = await callNext(request)
    totalDurationMs = round((time.time() - requestStartTime) * 1000, 2)
    response.headers["X-Response-Time"] = f"{totalDurationMs}ms"
    return response

# Register modular feature routers
app.include_router(searchRouter)
app.include_router(scrapeRouter)


@app.get(
    "/health",
    summary="Health Check",
    tags=["System"],
)
async def checkHealth() -> dict:
    """Verifies that the AirCrawl server is online and operational."""
    return {
        "status": "healthy",
        "service": "AirCrawl",
        "activeModules": ["search", "scrape"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
