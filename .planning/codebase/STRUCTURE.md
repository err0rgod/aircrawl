# Codebase Structure

**Analysis Date:** 2026-10-30

## Directory Layout

```
D:\aircrawl/
├── .github/
│   └── workflows/
│       └── deploy.yml        # Automated CI/CD pipeline and deployment
├── frontend/
│   ├── app.js                # Interactive playground state and controller
│   ├── index.html            # Static developer console UI
│   └── styles.css            # Air-themed custom stylesheet
├── parse/
│   ├── __init__.py           # Package marker
│   ├── extractor.py          # Groq-powered structured JSON parser
│   └── router.py             # FastAPI /v1/parse endpoint definition
├── scrape/
│   ├── __init__.py           # Package marker
│   ├── browserManager.py     # Singleton Chromium Playwright lifecycle manager
│   ├── router.py             # FastAPI /v1/scrape endpoint definition
│   └── scrape.py             # Dual-tier hybrid scraping engine & markdown converter
├── search/
│   ├── __init__.py           # Package marker
│   ├── exa.py                # Exa AI search integration wrapper
│   └── router.py             # FastAPI /v1/search endpoint definition
├── tests/
│   ├── __init__.py           # Package marker
│   └── test_api.py           # Pytest test suite covering endpoints and heuristics
├── .env                      # Local secret variables (gitignored)
├── .gitignore                # Git ignore patterns
├── GEMINI.md                 # Project guidelines, strict AWS account and naming rules
├── main.py                   # Root FastAPI app, middleware, lifespan, and server entry
├── pytest.ini                # Pytest configuration settings
├── README.md                 # Project overview and quick start guide
├── requirements.txt          # Python dependency specifications
└── TODO.md                   # Master project roadmap and implementation tracker
```

## Directory Purposes

### `scrape/`
- **Purpose:** Core web scraping and browser automation subsystem.
- **Key Files:**
  - `browserManager.py`: Singleton `BrowserManager` providing warm Playwright Chromium pooling and memory recycling.
  - `scrape.py`: Dual-tier scraper (`scrapeHttp` + `scrapeBrowser`), SPA heuristics (`isSpaOrBlocked`), and markdown extraction (`extractPageDetails`).
  - `router.py`: Declares `POST /v1/scrape` and validates `ScrapeRequest`.

### `search/`
- **Purpose:** Semantic web search capability powered by Exa.
- **Key Files:**
  - `exa.py`: Initializes `Exa` client and formats search results with highlights.
  - `router.py`: Declares `POST /v1/search` and validates `SearchRequest`.

### `parse/`
- **Purpose:** Structured JSON extraction from markdown or direct URLs via Groq LLMs.
- **Key Files:**
  - `extractor.py`: Assembles structured prompts, calls `openai/gpt-oss-120b` (or `llama-3.3-70b-versatile`), and parses strict JSON.
  - `router.py`: Declares `POST /v1/parse` and validates `ParseRequest`.

### `frontend/`
- **Purpose:** Developer-facing playground interface mounted at `/`.
- **Key Files:**
  - `index.html`: Responsive DOM structure featuring Scrape and Search console modes.
  - `app.js`: State management, DOM events, history storage, and API fetch calls.
  - `styles.css`: Dark terminal-inspired design using CSS variables and IBM Plex typography.

### `tests/`
- **Purpose:** Automated unit and regression test suite.
- **Key Files:**
  - `test_api.py`: Async integration tests testing `/health`, `/`, SPA detection heuristics, page details extraction, static scraping, and parse validation.

### `.github/workflows/`
- **Purpose:** Continuous integration and production deployment configuration.
- **Key Files:**
  - `deploy.yml`: Runs tests on pushes/PRs and deploys tagged releases (`v*`) to AWS Lightsail server via SSH.

## Key File Locations

**Application Entry Point:**
- `main.py`: ASGI application definition, router registration, lifespan hooks, and local Uvicorn launcher (`if __name__ == "__main__":`).

**Configuration Files:**
- `requirements.txt`: Python package dependencies.
- `pytest.ini`: Configures test discovery in `tests/` directory.
- `GEMINI.md`: Strict project rules (AWS profile `err0rgod`, camelCase naming, decision framework).
- `TODO.md`: Feature tracker detailing the 6 core pillars and infrastructure roadmap.
