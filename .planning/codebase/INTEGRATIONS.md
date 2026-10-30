# External Integrations

**Analysis Date:** 2026-10-30

## External APIs & Services

### 1. Exa Search API
- **Purpose:** Semantic, neural, and fast web search engine powering the `/v1/search` feature.
- **Client Library:** `exa-py` (`exa_py.Exa`)
- **Key Modules:** `search/exa.py`, `search/router.py`
- **Authentication:** `EXA_API_KEY` via environment variable or `.env`.
- **Primary Method:** `exaClient.search(query, num_results, type, contents={'highlights': bool})`
- **Output:** URL list, metadata, published dates, author attributes, and highlighted snippets.
- **Failure Handling:** Caught inside `searchWeb()` in `search/exa.py`, returning standardized `{ "success": false, "error": str(err) }` with 500 status returned by router.

### 2. Groq Cloud API
- **Purpose:** High-throughput, ultra-low-latency LLM inference engine powering structured data extraction (`/v1/parse`).
- **Client Library:** `groq` (`groq.AsyncGroq`)
- **Key Modules:** `parse/extractor.py`, `parse/router.py`
- **Authentication:** `GROQ_API_KEY` via environment variable or `.env`.
- **Models:**
  - Primary: `openai/gpt-oss-120b`
  - Fallback: `llama-3.3-70b-versatile`
- **Enforcement:** `response_format={"type": "json_object"}` with temperature 0.1 and strict system prompt guidelines.
- **Failure Handling:** Automatic model fallback if primary model is unavailable; exceptions surfaced as HTTP 400 (validation) or HTTP 500.

### 3. Web Target Scraping (HTTP & Chromium)
- **Purpose:** Direct interaction with target web destinations across the public internet.
- **Mechanisms:**
  - Static tier: `httpx.AsyncClient` with spoofed browser headers (`Mozilla/5.0... Chrome/124.0.0.0`).
  - Dynamic tier: Playwright Chromium browser instance (`scrape/browserManager.py`) running headless with sandbox mitigation flags.
- **Network Targets:** Arbitrary public URLs provided in `url` field of `/v1/scrape` or `/v1/parse`.

## Infrastructure & Cloud Services

### AWS Account Configuration
- **Designated AWS Profile/Account:** `err0rgod` (strictly mandated per project guidelines for all CLI, provisioning, and infra work).
- **Compute:** AWS Lightsail instance running Ubuntu 24.04 LTS.
- **Networking & SSL:** Nginx reverse proxy serving port 80/443 pointing to local Uvicorn ASGI port 8000, Let's Encrypt TLS certificates for `aircrawl.tech`.

### GitHub Actions CI/CD
- **Workflow File:** `.github/workflows/deploy.yml`
- **Triggers:** Push to `main`, Pull Requests, and Git release tags (`v*`).
- **Secrets Used:**
  - `SERVER_HOST`: Host IP or DNS of the Lightsail server.
  - `SERVER_USER`: SSH login username (`ubuntu`).
  - `SERVER_SSH_KEY`: Private SSH key for automated deployment.
- **Pipeline Actions:** Runs pytest test suite, on tag push logs in via SSH, pulls tag, installs dependencies, and restarts `aircrawl` systemd service.

## Environment Variables Configuration

| Variable | Required | Description | Used In |
|---|---|---|---|
| `EXA_API_KEY` | Yes (for search) | API key for Exa AI search queries | `search/exa.py` |
| `GROQ_API_KEY` | Yes (for parse) | API key for Groq LLM inference | `parse/extractor.py` |
| `SERVER_HOST` | CI/CD only | Deployment host IP/hostname | `.github/workflows/deploy.yml` |
| `SERVER_USER` | CI/CD only | Deployment SSH username | `.github/workflows/deploy.yml` |
| `SERVER_SSH_KEY`| CI/CD only | Deployment SSH private key | `.github/workflows/deploy.yml` |

## Planned Integrations (Roadmap)

- **AWS S3 Bucket:** Managed under AWS account `err0rgod` for storing screenshot artifacts and HTML snapshots.
- **Redis & Celery/BullMQ:** Distributed queue infrastructure for handling long-running multi-page crawl jobs.
- **Proxy Providers:** Residential and datacenter proxy rotation services for anti-bot mitigation.
