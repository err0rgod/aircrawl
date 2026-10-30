# Coding Conventions

**Analysis Date:** 2026-10-30

## Strict Project Rules (Mandatory)

Per `GEMINI.md`:
1. **Strict AWS Account Rule:** Always use the AWS account/profile `err0rgod` for any AWS configurations, CLI commands, infrastructure provisioning, and deployments related to this project. No other AWS account or profile should be used.
2. **Strict Variable Naming:** Use `camelCase` for variables, function arguments, and internal identifiers throughout the entire codebase (including Python and JavaScript).
3. **Decision Framework:** Never make unilateral engineering or architectural decisions. Always present:
   - Why X or Y (core problem and proposed directions)
   - What is the Z output (exact expected output/behavior)
   - Alternatives (A, B, C)
   - Tradeoffs (pros and cons)
   - User Confirmation (await user choice before implementing)

## Naming Conventions

### Python
- **Functions & Methods:** `camelCase` (e.g. `scrapeUrl`, `isSpaOrBlocked`, `extractPageDetails`, `getBrowser`, `createIncognitoContext`, `extractStructuredData`, `checkHealth`).
- **Variables & Arguments:** `camelCase` (e.g. `rawHtml`, `statusCode`, `pageDetails`, `requestStartTime`, `totalDurationMs`, `browserManagerInstance`, `scrapeRequest`).
- **Classes:** `PascalCase` (e.g. `BrowserManager`, `ScrapeRequest`, `SearchRequest`, `ParseRequest`).
- **Global Singletons / Instances:** `camelCase` with descriptive suffix (e.g. `browserManagerInstance`, `standardHeaders`, `scrapeRouter`, `searchRouter`, `parseRouter`).

### JavaScript
- **Functions:** `camelCase` (e.g. `cacheNodes`, `bindEvents`, `handleExecute`, `setMode`, `toggleFormat`).
- **Variables & State Objects:** `camelCase` (e.g. `historyStorageKey`, `markdownHistoryLimit`, `appState`, `currentMode`).
- **DOM Element Keys:** `camelCase` mapping to HTML IDs (`nodes.commandInput`, `nodes.runBtn`, `nodes.stage`).

## Response & Error Handling Standards

All service-level engines (`scrapeUrl`, `searchWeb`, `extractStructuredData`) return a standardized result envelope:

```python
{
    "success": True,         # bool: True if operation completed successfully
    "data": { ... },         # dict | None: Response payload
    "metrics": {
        "durationMs": 142.5  # float: Elapsed wall-clock time in milliseconds
    },
    "error": None            # str | None: Error message if failed
}
```

### Router HTTP Status Mapping
- On `success == True`: Return HTTP 200 with result payload.
- On client validation error: Raise `HTTPException(status_code=400, detail=...)`.
- On engine failure: Raise `HTTPException(status_code=500, detail=...)`.
- Response timing: Custom middleware automatically injects the `X-Response-Time` header on every response.

## Typing & Documentation

- **Python Type Hints:** Explicit annotations on all function signatures, parameters, and return types (`str | None`, `dict`, `int = 30000`).
- **Docstrings:** Standardized docstrings detailing purpose, parameters, and return values on all classes and functions.
- **Pydantic Schemas:** Field validation using `Field(...)` with descriptions and example values for automatic OpenAPI / Swagger generation.
