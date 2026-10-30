# Technology Stack

**Analysis Date:** 2026-10-30

## Languages

**Primary:**
- Python 3.12 / 3.13 - All core backend services, routers, managers, and testing (`main.py`, `scrape/`, `search/`, `parse/`, `tests/`)
- JavaScript (ES6+) - Static playground client application (`frontend/app.js`)

**Secondary:**
- HTML5 / CSS3 - Frontend playground markup and theme stylesheets (`frontend/index.html`, `frontend/styles.css`)
- YAML - GitHub Actions automated CI/CD pipeline (`.github/workflows/deploy.yml`)

## Runtime & Environment

**Backend Environment:**
- Python 3.12+ virtual environment (`.venv/`)
- Host: AWS Lightsail Ubuntu 24.04 LTS instance (AWS account: `err0rgod`)
- Headless browser: Chromium browser managed via Playwright (`playwright install chromium`)
- Web server / Reverse Proxy: Uvicorn ASGI server behind Nginx with Let's Encrypt SSL (`aircrawl.tech`)

**Package Management:**
- Manager: `pip` via `requirements.txt`
- Core manifest: `requirements.txt`

## Frameworks & Libraries

**Core API Framework:**
- `fastapi` (>=0.115.0) - High-performance async ASGI API framework with OpenAPI / Swagger documentation (`/docs`)
- `uvicorn` (>=0.30.0) - Production ASGI web server runner
- `pydantic` (>=2.10.0) - Request validation, schema coercion, and settings management

**Scraping, Rendering & Extraction Engine:**
- `playwright` (>=1.49.0) - Headless Chromium automation for dynamic JavaScript/SPA rendering and screenshot capture
- `httpx` (>=0.28.0) - Async HTTP client for sub-second static page fetching and ASGI testing transport
- `beautifulsoup4` (>=4.12.0) - HTML parsing, DOM sanitization, tag removal, metadata and link extraction
- `markdownify` (>=0.14.0) - HTML to clean ATX-style Markdown conversion
- `brotli` (>=1.1.0) - High-efficiency web content decompression

**External AI & Search Services:**
- `groq` (>=0.11.0) - Ultra-low-latency LLM inference for Type B structured JSON extraction (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`)
- `exa-py` (>=1.8.0) - Semantic and neural web search API client

**Frontend Libraries:**
- Tailwind CSS (CDN with typography plugin) - Responsive utility styling
- Lucide Icons (CDN) - UI iconography
- Marked.js (CDN) - Client-side markdown rendering in the playground

**Testing & Quality Tools:**
- `pytest` (>=9.1) & `pytest-asyncio` - Async test execution engine and ASGI endpoint testing (`tests/test_api.py`)
- `anyio` - Async concurrency primitives

## Key Dependencies Summary

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | `>=0.115.0` | REST API routes, middleware, request validation |
| `uvicorn` | `>=0.30.0` | Async event loop and ASGI HTTP server |
| `playwright` | `>=1.49.0` | Browser automation and SPA content extraction |
| `httpx` | `>=0.28.0` | Static scraping and asynchronous client transport |
| `beautifulsoup4` | `>=4.12.0` | DOM parsing, tag decomposition, link extraction |
| `markdownify` | `>=0.14.0` | Clean ATX Markdown generator |
| `groq` | `>=0.11.0` | Structured JSON schema extraction |
| `exa-py` | `>=1.8.0` | Semantic web search engine |
| `pydantic` | `>=2.10.0` | Data models and serialization |
| `python-dotenv` | `>=1.0.0` | Environment variable management (`.env`) |
