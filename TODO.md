# AirCrawl Project Roadmap & Master TODO

## 1. Core Engine Features
- [x] **1. Search:** Semantic web search via Exa AI (`/v1/search`)
- [x] **2. Scrape:** Dual-tier hybrid engine (sub-second HTTP + warm Playwright Chromium) with Markdown, links, metadata, screenshots, and latency metrics (`/v1/scrape`)
- [x] **4. Parse (Type B JSON):** High-precision structured schema extraction powered by Groq (`openai/gpt-oss-120b`) (`/v1/parse`)
- [ ] **3. Interact:** Browser action sequencer (`click`, `fill`, `scroll`, `wait`, `press`, `eval`) for dynamic interactions (`/v1/interact`)
- [ ] **5. Crawl Entire Website:** Recursive spidering engine with domain boundary scoping, sitemap ingestion, depth limits, and concurrent link queues (`/v1/crawl`)
- [ ] **6. Monitor:** Page change detection, scheduled recurring scrapes, visual and DOM diffing, and webhook notifications (`/v1/monitor`)
- [ ] **7. Code Understanding & Repo Ingestion:** Specialized engine to crawl code repositories (GitHub, GitLab), parse ASTs/file trees, strip noise, and output clean code context for LLMs (`/v1/code`)

---

## 2. API Support & Developer Experience
- [ ] **API Key Management:** Generate, revoke, and validate API keys for client access (`X-API-Key`)
- [ ] **Rate Limiting & Throttling:** Token bucket rate limiter per API key / IP tier
- [ ] **Webhooks Support:** Async callback notifications for completed crawl and scrape jobs
- [ ] **Client SDKs:** Official lightweight Python and TypeScript/Node.js client libraries (`pip install aircrawl`, `npm install aircrawl`)
- [ ] **Interactive API Docs:** Enhanced OpenAPI / Swagger documentation with request builders and code snippets

---

## 3. Account & User Management
- [ ] **Authentication & Identity:** User sign-up, login, and session management (JWT / OAuth2)
- [ ] **Organization & Team Workspaces:** Multi-user workspace access with role-based permissions
- [ ] **Usage Quotas & Billing:** Tiered plans (Free, Pro, Enterprise), credit deduction per request, and payment integration (Stripe / Lemon Squeezy)
- [ ] **Usage Analytics:** Request count tracking, success/failure rates, average latency, and credit balance displays

---

## 4. Security & Anti-Bot Protection
- [ ] **Proxy Infrastructure & Rotation:** Residential and datacenter proxy rotation support with sticky sessions
- [ ] **Stealth & Fingerprint Masking:** Advanced anti-bot measures (Canvas, WebGL, AudioContext, and TLS fingerprint randomization)
- [x] **SSRF & Input Hardening:** Strict URL validation and DNS resolution to block access to internal private IP ranges (e.g. `10.0.0.0/8`, `169.254.169.254`, `localhost`, link-local, carrier NAT, and IPv6 ULA)
- [ ] **Secrets & Vault Management:** Secure environment key storage and encrypted credential handling

---

## 5. Infrastructure, Queueing & Storage (Production Scaling)
- [ ] **Distributed Job Queue:** Redis + Celery/BullMQ worker pool to process massive multi-thousand page crawl jobs asynchronously without HTTP connection timeouts
- [ ] **Blob Storage (AWS S3):** Upload screenshots and raw HTML dumps directly to S3 storage bucket on AWS `err0rgod`
- [ ] **Response Caching Layer:** Cache identical scrape/search queries with configurable TTL to save compute and proxy bandwidth

---

## 6. Frontend UI & Dashboard
- [ ] **Playground Redesign:** Professional, high-polish developer console (clean minimal aesthetic, tabbed inspector, Monaco code editor, live response streaming)
- [ ] **Dashboard:** User dashboard for viewing past scrapes, crawl jobs, API key generator, and billing invoices

---

## 7. System Design & Architecture Documentation
- [ ] **End-to-End System Design Spec:** Formal architecture document detailing component interactions, C4 diagrams, sequence diagrams, and failure recovery
- [ ] **Scale & Capacity Planning:** Concurrency models, memory budgeting for Chromium instances on AWS Lightsail/EC2, and network bandwidth estimates
- [ ] **Database & Queue Schemas:** Redis job state schemas, task status transitions, and data persistence models

---

## DevOps & Deployment Status
- [x] FastAPI modular router architecture
- [x] AWS Lightsail Ubuntu 24.04 instance running on AWS account `err0rgod`
- [x] Domain `aircrawl.tech` connected with Nginx reverse proxy and Let's Encrypt SSL
- [x] Automated test suite (`pytest`) with 100% pass rate
- [x] Automated GitHub Actions CI/CD pipeline triggered by version tags (`v*`)
