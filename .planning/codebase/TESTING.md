# Testing Patterns & Practices

**Analysis Date:** 2026-10-30

## Testing Framework & Setup

- **Test Framework:** `pytest` (>=9.1)
- **Async Extension:** `pytest-asyncio` (auto mode enabled)
- **ASGI Test Transport:** `httpx.AsyncClient` utilizing `ASGITransport(app=app)` to test endpoints in-memory without binding live network sockets.
- **Test Configuration:** `pytest.ini`:
  ```ini
  [pytest]
  testpaths = tests
  python_files = test_*.py
  python_classes = Test*
  python_functions = test_*
  asyncio_mode = auto
  ```

## Test Directory & File Structure

```
tests/
├── __init__.py
├── test_api.py       # Integration and unit tests for endpoints, parsers, and heuristics
└── test_ssrf.py      # SSRF validation, private IP blocking, redirect protections, and rejection tests
```

## Existing Test Coverage (14 Passing Tests)

| Test Function | Target Tested | Verification Assertions |
|---|---|---|
| `testHealthEndpoint` | `GET /health` | Status 200, `"status": "healthy"`, activeModules contains `"search"`, `"scrape"`, `"parse"`. |
| `testFrontendRoot` | `GET /` | Status 200, serves valid HTML containing `"<!DOCTYPE html>"`, `"AirCrawl"`, `modeParseBtn`, and `parseControls`. |
| `testSpaDetectionHelper` | `scrape.scrape.isSpaOrBlocked` | Validates heuristic against SPA empty divs (`#app`), static content, and HTTP 403 blocks. |
| `testPageDetailsExtraction` | `scrape.scrape.extractPageDetails` | Verifies metadata extraction, relative link resolution, and markdown generation without scripts. |
| `testScrapeEndpointStatic` | `POST /v1/scrape` | Tests static HTTP mode against `https://example.com`, checking `metrics.durationMs` and `X-Response-Time` header. |
| `testParseValidationMissingInput` | `POST /v1/parse` | Tests error handling when both `url` and `markdown` are omitted; expects HTTP 400. |
| `testPrivateIpValidation` | `scrape.security.validateTargetUrl` | Verifies loopback (`127.0.0.1`), RFC 1918 private IPs (`10.0.0.5`, `192.168.1.1`, `172.16.0.1`), and IPv6 `::1` raise `SsrfValidationError`. |
| `testCloudMetadataValidation` | `scrape.security.validateTargetUrl` | Verifies cloud metadata IP (`169.254.169.254`) and link-local IPv6 raise `SsrfValidationError`. |
| `testInvalidSchemesValidation` | `scrape.security.validateTargetUrl` | Verifies non-HTTP/HTTPS schemes (`file:`, `ftp:`, `gopher:`, `data:`, `ldap:`) raise `SsrfValidationError`. |
| `testSpecialHostnamesValidation` | `scrape.security.validateTargetUrl` | Verifies `.internal`, `.local`, `.localhost` raise `SsrfValidationError`. |
| `testValidPublicUrlValidation` | `scrape.security.validateTargetUrl` | Confirms legitimate public URLs (`https://example.com`) pass validation without raising exceptions. |
| `testScrapeEndpointSsrfRejection` | `POST /v1/scrape` | Verifies endpoint returns HTTP 400 Bad Request with blocked detail when given SSRF target URLs. |
| `testParseEndpointSsrfRejection` | `POST /v1/parse` | Verifies endpoint returns HTTP 400 Bad Request when given SSRF target URLs. |
| `testRedirectSsrfProtection` | `scrape.scrape.scrapeHttp` | Verifies HTTP 301/302 redirects targeting private internal IP addresses are trapped and blocked. |

## Running Tests Locally

Execute all test cases:
```bash
pytest -v
```

Execute a specific test file:
```bash
pytest tests/test_api.py -v
```

Execute a specific test function:
```bash
pytest tests/test_api.py -k "testHealthEndpoint" -v
```

## Continuous Integration (CI)

In `.github/workflows/deploy.yml`:
1. Checkout code
2. Setup Python 3.12 with pip cache
3. Install dependencies from `requirements.txt`
4. Install `playwright install --with-deps chromium`
5. Run `pytest -v` (blocks deployment if any test fails)
