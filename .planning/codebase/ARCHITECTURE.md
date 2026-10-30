# Architecture

**Analysis Date:** 2026-10-30

## Pattern Overview

**Overall Architecture:** Modular Async REST API (FastAPI) paired with a Dual-Tier Web Scraping Engine and an embedded Static Playground UI.

**Key Characteristics:**
- **Dual-Tier Scraping:** Sub-second static HTTP fetching via `httpx` with automatic heuristic fallback to warm headless Playwright Chromium when SPAs, JavaScript rendering, or Cloudflare/bot challenges are detected.
- **Warm Browser Pooling:** Chromium is kept alive in memory via a singleton `BrowserManager`, generating isolated incognito contexts per scrape to avoid slow browser startup overhead and memory bloat.
- **Strict Asynchronous Execution:** Async request handling across routes, HTTP scraping, browser execution, and Groq LLM inference.
- **Embedded Developer Console:** Static HTML/JS frontend playground mounted directly at root (`/`) for immediate testing and documentation exploration.

## System Layers

### 1. Transport & Gateway Layer
- **Components:** `main.py`
- **Responsibilities:**
  - Application lifecycle management (`appLifespan`) ensuring graceful startup and Playwright browser shutdown.
  - Global CORS middleware allowing cross-origin agent and client integration.
  - Custom HTTP middleware (`addExecutionTimeHeader`) calculating precise server-side duration and adding `X-Response-Time` header.
  - Static file mounting for the frontend client at `/`.
  - System health endpoint (`/health`).

### 2. Routing & Controller Layer
- **Components:** `scrape/router.py`, `search/router.py`, `parse/router.py`
- **Responsibilities:**
  - Pydantic schema validation for incoming requests (`ScrapeRequest`, `SearchRequest`, `ParseRequest`).
  - Route prefixing under `/v1/`.
  - HTTP error mapping, returning appropriate status codes (400 for bad parameters, 500 for engine errors).

### 3. Engine & Service Layer
- **Components:**
  - **Scrape Engine (`scrape/scrape.py`):**
    - `isSpaOrBlocked`: Heuristics scanning for empty mount IDs (`#app`, `#root`, `#__next`, `#__nuxt`), challenge platforms, or tiny body lengths with script tags.
    - `scrapeHttp`: Async HTTP request yielding raw HTML or triggering fallback.
    - `scrapeBrowser`: Headless Chromium navigation using warm context, waiting for network idle or custom selector, and optional base64 screenshot capture.
    - `extractPageDetails`: HTML sanitization, script/style decomposition, metadata extraction, link discovery, and ATX-style markdown conversion via `markdownify`.
    - `scrapeUrl`: Unified orchestration layer implementing `auto`, `http`, and `browser` execution modes.
  - **Browser Lifecycle Manager (`scrape/browserManager.py`):**
    - Singleton `BrowserManager` managing Chromium launch arguments (`--no-sandbox`, `--disable-dev-shm-usage`, etc.).
    - Creates and destroys isolated `BrowserContext` instances per request.
    - Automatic browser recycling after 150 processed requests to eliminate memory leak risks.
  - **Search Engine (`search/exa.py`):**
    - Wraps `exa-py` for semantic and neural querying, returning structured search items with highlighted text snippets.
  - **Structured Parse Engine (`parse/extractor.py`):**
    - Consumes raw markdown or fetches live URLs.
    - Formulates system and schema-enforcing prompts for Groq LLM.
    - Executes JSON completion against `openai/gpt-oss-120b` with fallback to `llama-3.3-70b-versatile`.

### 4. Client Presentation Layer
- **Components:** `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`
- **Responsibilities:**
  - Live interactive playground with dual Scrape and Search console modes.
  - Markdown preview rendering with Marked.js, screenshot viewing, and raw JSON inspection.
  - Local history persistence via `localStorage` (`aircrawl.history.v1`).
  - Periodic background polling of `/health`.

## Data Flow Diagrams

### Scrape Execution Flow (`POST /v1/scrape`)

```
[ Client / Agent ]
       │
       ▼
[ FastAPI Gateway (main.py) ] ── (Records start time)
       │
       ▼
[ Scrape Router (scrape/router.py) ] ── (Validates ScrapeRequest)
       │
       ▼
[ Scrape Engine (scrape/scrape.py) ]
       │
       ├── Mode = 'http' ──► [ scrapeHttp ] ──► (HTTP GET)
       │
       ├── Mode = 'browser' or Screenshot requested:
       │     └──► [ BrowserManager ] ──► (Incognito Context) ──► (Chromium Page)
       │
       └── Mode = 'auto' (Default):
             ├── 1. Attempt [ scrapeHttp ]
             │      └── If isSpaOrBlocked() == True:
             │             └── Fallback ──► [ scrapeBrowser ]
             └── 2. Return clean HTML / Markdown / Metadata
       │
       ▼
[ Output Formatter ] ── (Filters formats, compiles timing metrics)
       │
       ▼
[ HTTP Response + 'X-Response-Time' header ]
```

### Parse Execution Flow (`POST /v1/parse`)

```
[ Client ] ──► [ Parse Router (parse/router.py) ]
                      │
                      ▼
             [ Parse Extractor (parse/extractor.py) ]
                      │
       ┌──────────────┴──────────────┐
       │ (If URL provided)           │ (If Markdown provided)
       ▼                             ▼
[ scrapeUrl(formats=['markdown']) ]  │
       │                             │
       └──────────────┬──────────────┘
                      ▼
           [ Prompt Construction ]
     (System instruction + Markdown text + JSON Schema)
                      │
                      ▼
             [ Groq Async Client ]
     (Tries openai/gpt-oss-120b ──► Fallback: llama-3.3-70b-versatile)
                      │
                      ▼
         [ JSON Validation & Output ] ──► [ HTTP 200 Response ]
```
