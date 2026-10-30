# Codebase Concerns & Technical Debt

**Analysis Date:** 2026-10-30

## Technical Debt & Gaps

### 1. Missing Parse Mode in Playground UI
- **Issue:** The backend provides a fully functional `/v1/parse` endpoint (`parse/router.py`, `parse/extractor.py`), but the frontend developer console (`frontend/index.html` and `frontend/app.js`) currently only exposes **Scrape** and **Search** modes.
- **Why:** Parse was recently implemented in the backend as Type B JSON extraction, and the UI has not yet been extended with schema/prompt input fields and JSON inspector tabs.
- **Impact:** Developers cannot test structured extraction directly from the web UI; they must use `/docs` (Swagger) or curl.
- **Fix Approach:** Add a third mode button ("Parse") to `frontend/index.html` and integrate prompt/schema textarea controls in `frontend/app.js`.

### 2. Single-Host Synchronous Scrape Execution
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

### 1. SSRF (Server-Side Request Forgery) Vulnerability
- **Risk:** High. The `scrapeUrl` and `extractStructuredData` functions accept arbitrary target URLs from user input and make outbound HTTP/browser requests.
- **Current State:** No private IP or localhost filtering is implemented. An attacker could potentially request `http://169.254.169.254/latest/meta-data/` (AWS EC2/Lightsail instance metadata) or internal loopback services (`http://127.0.0.1:8000`).
- **Mitigation Needed:** Implement strict URL validation before making requests, resolving DNS and blocking private CIDR blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`).

### 2. Unauthenticated API Endpoints
- **Risk:** Medium. All endpoints (`/v1/scrape`, `/v1/search`, `/v1/parse`) are currently public and unauthenticated with CORS allowed for all origins (`*`).
- **Current State:** No API key check or IP rate limiting.
- **Mitigation Needed:** Implement API key validation (`X-API-Key`) and token-bucket rate limiting (tracked in TODO.md section 2).

## Roadmap Priorities (from `TODO.md`)

- **Core Feature 3 (`/v1/interact`):** Browser interaction sequencer (`click`, `fill`, `scroll`, `wait`, `press`, `eval`).
- **Core Feature 5 (`/v1/crawl`):** Recursive website crawler with link queue and domain boundary scoping.
- **Core Feature 6 (`/v1/monitor`):** Periodic change detection and webhooks.
- **Core Feature 7 (`/v1/code`):** Git repo ingestion and AST/clean code understanding.
