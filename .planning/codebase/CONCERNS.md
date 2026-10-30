# Codebase Concerns & Technical Debt

**Analysis Date:** 2026-10-30

## Resolved Concerns & Fixes

### 1. Missing Parse Mode in Playground UI [RESOLVED]
- **Status:** Resolved in `frontend/index.html`, `frontend/app.js`, and `frontend/styles.css`.
- **Implementation:** Added full Parse console mode with URL/Direct Markdown toggle, prompt textarea, JSON Schema validator with sample loader, Groq model selector (`openai/gpt-oss-120b` and `llama-3.3-70b-versatile`), syntax-highlighted structured JSON output, raw JSON tab, and performance/token metrics tab.

### 2. SSRF (Server-Side Request Forgery) Vulnerability [RESOLVED]
- **Status:** Resolved via `scrape/security.py`.
- **Implementation:** Integrated strict `validateTargetUrl()` into `scrape/scrape.py` and `parse/extractor.py`. Blocks private IPv4/IPv6 networks, loopback, link-local, AWS EC2/Lightsail metadata (`169.254.169.254`), non-HTTP schemes, and internal hostnames. Tested and verified in `tests/test_ssrf.py`.

## Technical Debt & Active Gaps

### 1. Single-Host Synchronous Scrape Execution
- **Issue:** All scrape requests are processed synchronously within the incoming HTTP request cycle.
- **Why:** Initial architecture optimized for low-latency single-page scraping without heavy infrastructure overhead.
- **Impact:** Long-running requests (e.g. slow websites with 30s timeouts) tie up Uvicorn worker threads. For future `/v1/crawl` multi-page jobs, HTTP connections will timeout.
- **Fix Approach:** Introduce a distributed task queue (Redis + Celery or BullMQ) for asynchronous job submission, progress tracking, and webhook callback delivery.

### 3. Screenshot Delivery via Base64
- **Issue:** When screenshot capture is requested, the image is encoded as a Base64 string in the JSON response payload.
- **Why:** Convenient for quick prototyping without requiring external cloud object storage.
- **Impact:** Substantially increases JSON response payload size (often 200KB - 2MB) and memory consumption.
- **Fix Approach:** Upload screenshots directly to an AWS S3 bucket under AWS account `err0rgod` and return signed CDN/S3 URLs in the JSON metadata.

## Security Considerations

### 1. Unauthenticated API Endpoints
- **Risk:** Medium. All endpoints (`/v1/scrape`, `/v1/search`, `/v1/parse`) are currently public and unauthenticated with CORS allowed for all origins (`*`).
- **Current State:** No API key check or IP rate limiting.
- **Mitigation Needed:** Implement API key validation (`X-API-Key`) and token-bucket rate limiting (tracked in TODO.md section 2).

## Roadmap Priorities (from `TODO.md`)

- **Core Feature 3 (`/v1/interact`):** Browser interaction sequencer (`click`, `fill`, `scroll`, `wait`, `press`, `eval`).
- **Core Feature 5 (`/v1/crawl`):** Recursive website crawler with link queue and domain boundary scoping.
- **Core Feature 6 (`/v1/monitor`):** Periodic change detection and webhooks.
- **Core Feature 7 (`/v1/code`):** Git repo ingestion and AST/clean code understanding.
