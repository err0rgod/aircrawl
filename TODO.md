# AirCrawl Project Roadmap & TODO

## Core Functions Status
- [x] **1. Search:** Web search via Exa AI (`/v1/search`)
- [x] **2. Scrape:** Dual-tier hybrid scraper (fast HTTP + warm Playwright Chromium) outputting Markdown, links, Type A metadata, and screenshots (`/v1/scrape`)
- [ ] **3. Interact:** Browser action sequencer (`click`, `fill`, `scroll`, `wait`, `press`) *(Deferred for now)*
- [ ] **4. Parse:** LLM-powered Type B structured JSON extraction (`/v1/parse`) *(In Progress)*
- [ ] **5. Crawl:** Recursive domain spidering and link queuing (`/v1/crawl`)
- [ ] **6. Monitor:** Page change detection and recurring scrape alerts (`/v1/monitor`)

## Infrastructure & DevOps
- [x] FastAPI modular router setup (`search`, `scrape`)
- [x] AWS Lightsail server provisioned on `err0rgod` (`43.205.239.36`)
- [x] Domain `aircrawl.tech` connected with Nginx reverse proxy and SSL
- [x] Automated test suite (`pytest`) with 100% pass rate
- [x] GitHub Actions CI/CD with conditional tagged releases (`v*`)
