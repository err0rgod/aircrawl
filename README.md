# AirCrawl

A lightweight, high-performance Firecrawl alternative built with FastAPI, Playwright, and Exa Search.

## 6 Core Features
- [x] **Search:** Fast semantic web search powered by Exa.
- [x] **Scrape:** Dual-tier hybrid scraping (sub-second static HTTP + warm Chromium browser for SPAs) outputting clean Markdown, metadata, and screenshots.
- [ ] **Interact:** Browser interaction primitives (click, fill, scroll, wait, press).
- [ ] **Parse:** LLM-powered structured JSON schema extraction.
- [ ] **Crawl:** Recursive website spidering with domain scoping and queueing.
- [ ] **Monitor:** Webpage change detection and recurring scrape alerts.

## Quick Start

### 1. Installation
```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
EXA_API_KEY=your_exa_api_key_here
```

### 3. Run the Server
```bash
python main.py
```
Open interactive Swagger documentation at: `http://localhost:8000/docs`
