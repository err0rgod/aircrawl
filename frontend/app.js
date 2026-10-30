const historyStorageKey = "aircrawl.history.v1";
const markdownHistoryLimit = 40000;
const historyLimit = 8;

const engineHints = {
    auto: "HTTP first. Falls back to a warm browser when the page looks like a shell or a block page.",
    http: "Static fetch only. Fails when the page needs JavaScript.",
    browser: "Headless Chromium. Use this for apps, and when you need a screenshot.",
};

const defaultSampleSchema = {
    type: "object",
    properties: {
        productOrService: { type: "string" },
        pricingTiers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tierName: { type: "string" },
                    price: { type: "string" },
                    billingCycle: { type: "string" },
                    features: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: ["tierName", "price"],
            },
        },
    },
    required: ["pricingTiers"],
};

const samples = {
    static: { mode: "scrape", value: "https://example.com", label: "Static HTML" },
    spa: { mode: "scrape", value: "https://zerodaily.in", label: "Single-page app" },
    links: { mode: "scrape", value: "https://news.ycombinator.com", label: "Link-heavy page" },
    pricing: {
        mode: "parse",
        value: "https://zerodaily.in",
        label: "Pricing & Stories",
        prompt: "Extract the headline, key categories, and top news items with short summaries.",
        schema: {
            type: "object",
            properties: {
                headline: { type: "string" },
                categories: {
                    type: "array",
                    items: { type: "string" },
                },
                stories: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            summary: { type: "string" },
                        },
                        required: ["title"],
                    },
                },
            },
            required: ["headline", "stories"],
        },
    },
    query: { mode: "search", value: "what is zerodaily.in", label: "Search question" },
};

const draftInputs = {
    scrape: "https://zerodaily.in",
    search: "what is zerodaily.in",
    parse: "https://zerodaily.in",
};

const nodes = {};
const appState = {
    isRunning: false,
    timerId: 0,
    lastResponse: null,
    lastKind: "",
    lastRequest: null,
    lastTiming: "",
    history: [],
    activeHistoryId: "",
    outputTab: "",
};

let currentMode = "";

document.addEventListener("DOMContentLoaded", () => {
    cacheNodes();
    bindEvents();
    loadHistory();
    renderHistory();
    const shortcutKey = document.getElementById("shortcutKey");
    if (shortcutKey && /Mac|iPhone|iPad/.test(navigator.userAgent)) {
        shortcutKey.textContent = "⌘";
    }
    setMode("scrape");
    nodes.commandInput.value = draftInputs.scrape;
    updateScreenshotHint();
    renderEmpty();
    refreshIcons();
    checkBackendHealth();
    setInterval(checkBackendHealth, 20000);
});

function cacheNodes() {
    [
        "healthBadge",
        "healthLabel",
        "modeScrapeBtn",
        "modeSearchBtn",
        "modeParseBtn",
        "historyList",
        "historyEmpty",
        "clearHistoryBtn",
        "commandForm",
        "commandEyebrow",
        "commandHint",
        "commandInput",
        "runBtn",
        "runLabel",
        "scrapeControls",
        "searchControls",
        "parseControls",
        "parseSourceGroup",
        "parseModelGroup",
        "parseMarkdownField",
        "parseMarkdownInput",
        "parsePrompt",
        "parseSchema",
        "schemaStatus",
        "loadSampleSchemaBtn",
        "clearSchemaBtn",
        "formatChips",
        "engineGroup",
        "engineHint",
        "screenshotHint",
        "advancedToggle",
        "advancedPanel",
        "waitForSelector",
        "timeoutMs",
        "searchLimit",
        "searchTypeGroup",
        "includeHighlights",
        "errorBanner",
        "progressBar",
        "statusLine",
        "stage",
    ].forEach((id) => {
        nodes[id] = document.getElementById(id);
    });
}

function bindEvents() {
    nodes.modeScrapeBtn.addEventListener("click", () => setMode("scrape"));
    nodes.modeSearchBtn.addEventListener("click", () => setMode("search"));
    nodes.modeParseBtn.addEventListener("click", () => setMode("parse"));
    nodes.commandForm.addEventListener("submit", handleExecute);
    nodes.commandForm.addEventListener("click", handleFormClick);
    nodes.advancedToggle.addEventListener("click", toggleAdvanced);
    nodes.clearHistoryBtn.addEventListener("click", clearHistory);
    nodes.historyList.addEventListener("click", handleHistoryClick);
    nodes.stage.addEventListener("click", handleStageClick);
    nodes.stage.addEventListener("input", handleStageInput);
    nodes.parseSchema.addEventListener("input", updateSchemaValidation);
    nodes.loadSampleSchemaBtn.addEventListener("click", () => {
        nodes.parseSchema.value = JSON.stringify(defaultSampleSchema, null, 2);
        updateSchemaValidation();
    });
    nodes.clearSchemaBtn.addEventListener("click", () => {
        nodes.parseSchema.value = "";
        updateSchemaValidation();
    });
    document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            nodes.commandForm.requestSubmit();
        }
    });
}

function handleFormClick(event) {
    const formatButton = event.target.closest("[data-format]");
    if (formatButton) {
        toggleFormat(formatButton);
        return;
    }
    const engineButton = event.target.closest("[data-engine]");
    if (engineButton) {
        selectEngine(engineButton.dataset.engine);
        return;
    }
    const typeButton = event.target.closest("[data-search-type]");
    if (typeButton) {
        selectSearchType(typeButton.dataset.searchType);
        return;
    }
    const parseSourceButton = event.target.closest("[data-parse-source]");
    if (parseSourceButton) {
        selectParseSource(parseSourceButton.dataset.parseSource);
        return;
    }
    const modelButton = event.target.closest("[data-model]");
    if (modelButton) {
        selectParseModel(modelButton.dataset.model);
        return;
    }
}

function handleStageClick(event) {
    const tabButton = event.target.closest("[data-output-tab]");
    if (tabButton) {
        showOutputTab(tabButton.dataset.outputTab);
        return;
    }
    const sampleButton = event.target.closest("[data-sample]");
    if (sampleButton) {
        applySample(sampleButton.dataset.sample);
        return;
    }
    const scrapeButton = event.target.closest("[data-scrape-url]");
    if (scrapeButton) {
        const targetUrl = scrapeButton.dataset.scrapeUrl;
        setMode("scrape");
        nodes.commandInput.value = targetUrl;
        draftInputs.scrape = targetUrl;
        nodes.commandInput.focus();
        return;
    }
    const parseButton = event.target.closest("[data-parse-url]");
    if (parseButton) {
        const targetUrl = parseButton.dataset.parseUrl;
        setMode("parse");
        selectParseSource("url");
        nodes.commandInput.value = targetUrl;
        draftInputs.parse = targetUrl;
        nodes.commandInput.focus();
        return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "copy") copyActiveContent(actionButton);
    if (action === "download") downloadActiveContent();
    if (action === "curl") copyCurl(actionButton);
    if (action === "copy-link") copyText(actionButton.dataset.copyLink || "", actionButton);
}

function handleStageInput(event) {
    if (event.target.id === "linkFilter") filterLinkRows(event.target.value);
}

function handleHistoryClick(event) {
    const item = event.target.closest("[data-history-id]");
    if (!item) return;
    restoreHistory(item.dataset.historyId);
}

function setMode(nextMode) {
    if (currentMode) draftInputs[currentMode] = nodes.commandInput.value;
    if (currentMode && currentMode !== nextMode) hideError();
    currentMode = nextMode;
    const isScrape = nextMode === "scrape";
    const isSearch = nextMode === "search";
    const isParse = nextMode === "parse";

    nodes.modeScrapeBtn.classList.toggle("is-on", isScrape);
    nodes.modeSearchBtn.classList.toggle("is-on", isSearch);
    nodes.modeParseBtn.classList.toggle("is-on", isParse);
    nodes.modeScrapeBtn.setAttribute("aria-pressed", String(isScrape));
    nodes.modeSearchBtn.setAttribute("aria-pressed", String(isSearch));
    nodes.modeParseBtn.setAttribute("aria-pressed", String(isParse));

    nodes.scrapeControls.hidden = !isScrape;
    nodes.searchControls.hidden = !isSearch;
    nodes.parseControls.hidden = !isParse;

    if (isScrape) {
        nodes.commandEyebrow.textContent = "Scrape";
        nodes.commandHint.textContent = "Fast HTTP, then a warm browser when the page is a shell. You get markdown, HTML, links, and screenshots.";
        nodes.commandInput.placeholder = "https://zerodaily.in";
        nodes.commandInput.setAttribute("aria-label", "Page URL");
        nodes.commandInput.disabled = false;
        if (!appState.isRunning) nodes.runLabel.textContent = "Run scrape";
    } else if (isSearch) {
        nodes.commandEyebrow.textContent = "Search";
        nodes.commandHint.textContent = "Semantic search through Exa. Send any result straight to scrape.";
        nodes.commandInput.placeholder = "Search query, for example latest tech breakthroughs";
        nodes.commandInput.setAttribute("aria-label", "Search query");
        nodes.commandInput.disabled = false;
        if (!appState.isRunning) nodes.runLabel.textContent = "Run search";
    } else if (isParse) {
        nodes.commandEyebrow.textContent = "Parse";
        nodes.commandHint.textContent = "Extract strictly typed JSON from a webpage or direct markdown using Groq LLM inference.";
        updateParseSourceView();
        if (!appState.isRunning) nodes.runLabel.textContent = "Run parse";
    }
    nodes.commandInput.value = draftInputs[nextMode] || "";
    refreshIcons();
}

function selectParseSource(sourceType) {
    setSegment(nodes.parseSourceGroup, "data-parse-source", sourceType);
    updateParseSourceView();
}

function selectParseModel(modelName) {
    setSegment(nodes.parseModelGroup, "data-model", modelName);
}

function updateParseSourceView() {
    const source = segmentValue(nodes.parseSourceGroup, "data-parse-source") || "url";
    const isUrl = source === "url";
    nodes.parseMarkdownField.hidden = isUrl;
    if (currentMode === "parse") {
        if (isUrl) {
            nodes.commandInput.placeholder = "https://zerodaily.in";
            nodes.commandInput.setAttribute("aria-label", "Webpage URL to parse");
            nodes.commandInput.disabled = false;
        } else {
            nodes.commandInput.placeholder = "Parsing direct markdown content provided below...";
            nodes.commandInput.disabled = true;
        }
    }
}

function updateSchemaValidation() {
    const value = nodes.parseSchema.value.trim();
    if (!value) {
        nodes.schemaStatus.hidden = true;
        return;
    }
    nodes.schemaStatus.hidden = false;
    try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
            nodes.schemaStatus.textContent = "Valid JSON";
            nodes.schemaStatus.className = "schema-status ok";
        } else {
            nodes.schemaStatus.textContent = "Must be Object";
            nodes.schemaStatus.className = "schema-status error";
        }
    } catch {
        nodes.schemaStatus.textContent = "Invalid JSON";
        nodes.schemaStatus.className = "schema-status error";
    }
}

function toggleAdvanced() {
    const willOpen = nodes.advancedPanel.hidden;
    nodes.advancedPanel.hidden = !willOpen;
    nodes.advancedToggle.setAttribute("aria-expanded", String(willOpen));
    refreshIcons();
}

function toggleFormat(button) {
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(next));
    button.classList.toggle("is-on", next);
    updateScreenshotHint();
}

function selectEngine(engineName) {
    setSegment(nodes.engineGroup, "data-engine", engineName);
    nodes.engineHint.textContent = engineHints[engineName] || "";
    updateScreenshotHint();
}

function selectSearchType(searchType) {
    setSegment(nodes.searchTypeGroup, "data-search-type", searchType);
}

function setSegment(group, attribute, value) {
    group.querySelectorAll("[" + attribute + "]").forEach((button) => {
        const on = button.getAttribute(attribute) === value;
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-checked", String(on));
    });
}

function segmentValue(group, attribute) {
    const active = group.querySelector(".is-on");
    return active ? active.getAttribute(attribute) : "";
}

function selectedFormats() {
    return [...nodes.formatChips.querySelectorAll("[aria-pressed='true']")].map((button) => button.dataset.format);
}

function updateScreenshotHint() {
    const wantsShot = selectedFormats().includes("screenshot");
    const engine = segmentValue(nodes.engineGroup, "data-engine");
    if (!wantsShot) {
        nodes.screenshotHint.hidden = true;
        return;
    }
    nodes.screenshotHint.hidden = false;
    nodes.screenshotHint.textContent = engine === "http"
        ? "HTTP mode does not capture screenshots. Switch the engine to Auto or Browser."
        : "Screenshots use headless Chromium. In Auto, the fast HTTP path is skipped.";
}

function applySample(sampleKey) {
    const sample = samples[sampleKey];
    if (!sample) return;
    setMode(sample.mode);
    nodes.commandInput.value = sample.value;
    draftInputs[sample.mode] = sample.value;
    if (sample.mode === "parse") {
        selectParseSource("url");
        if (sample.prompt) nodes.parsePrompt.value = sample.prompt;
        if (sample.schema) {
            nodes.parseSchema.value = JSON.stringify(sample.schema, null, 2);
            updateSchemaValidation();
        }
    }
    nodes.commandInput.focus();
}

async function handleExecute(event) {
    event.preventDefault();
    if (appState.isRunning) return;
    hideError();
    const inputValue = nodes.commandInput.value.trim();
    if (currentMode === "scrape" && !inputValue) {
        showError("Enter a URL to scrape.");
        return;
    }
    if (currentMode === "search" && !inputValue) {
        showError("Enter a search query.");
        return;
    }
    if (currentMode === "parse") {
        const parseSource = segmentValue(nodes.parseSourceGroup, "data-parse-source") || "url";
        if (parseSource === "url" && !inputValue) {
            showError("Enter a webpage URL to parse.");
            return;
        }
        if (parseSource === "markdown" && !nodes.parseMarkdownInput.value.trim()) {
            showError("Enter markdown content to parse.");
            return;
        }
    }

    let request;
    try {
        if (currentMode === "scrape") request = buildScrapeRequest(inputValue);
        else if (currentMode === "search") request = buildSearchRequest(inputValue);
        else if (currentMode === "parse") request = buildParseRequest();
    } catch (validationError) {
        showError(validationError.message);
        return;
    }

    setRunning(true);
    const startedAt = performance.now();
    try {
        const result = await postJson(request.path, request.body);
        appState.lastResponse = result.payload;
        appState.lastKind = currentMode;
        appState.lastRequest = request;
        appState.lastTiming = result.serverTiming || "";
        const record = rememberRun(request, result.payload, result.serverTiming || "");
        appState.activeHistoryId = record.id;
        renderHistory();
        renderCurrent();
        const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        const modeLabel = currentMode === "scrape" ? "Scrape" : (currentMode === "search" ? "Search" : "Parse");
        setStatus(modeLabel + " finished in " + seconds + " seconds.");
    } catch (requestError) {
        showError(requestError.message || "Request failed.");
    } finally {
        setRunning(false);
    }
}

function buildParseRequest() {
    const parseSource = segmentValue(nodes.parseSourceGroup, "data-parse-source") || "url";
    const body = {
        model: segmentValue(nodes.parseModelGroup, "data-model") || "openai/gpt-oss-120b",
    };
    if (parseSource === "url") {
        const rawUrl = nodes.commandInput.value.trim();
        if (!rawUrl) throw new Error("Enter a webpage URL to parse.");
        const url = normalizeUrl(rawUrl);
        if (!safeHttpUrl(url)) throw new Error("Enter a full http or https URL.");
        body.url = url;
        draftInputs.parse = url;
        nodes.commandInput.value = url;
    } else {
        const markdown = nodes.parseMarkdownInput.value.trim();
        if (!markdown) throw new Error("Enter markdown content to parse.");
        body.markdown = markdown;
    }

    const prompt = nodes.parsePrompt.value.trim();
    if (prompt) body.prompt = prompt;

    const schemaRaw = nodes.parseSchema.value.trim();
    if (schemaRaw) {
        try {
            body.schema = JSON.parse(schemaRaw);
        } catch {
            throw new Error("Target schema must be valid JSON.");
        }
    }

    return { path: "/v1/parse", body: body };
}

function buildScrapeRequest(inputValue) {
    const formats = selectedFormats();
    if (formats.length === 0) throw new Error("Pick at least one format.");
    const url = normalizeUrl(inputValue);
    if (!safeHttpUrl(url)) throw new Error("Enter a full http or https URL.");
    const timeoutMs = clampNumber(nodes.timeoutMs.value, 1000, 120000, 30000);
    nodes.timeoutMs.value = String(timeoutMs);
    const body = {
        url: url,
        mode: segmentValue(nodes.engineGroup, "data-engine") || "auto",
        formats: formats,
        timeoutMs: timeoutMs,
    };
    const selector = nodes.waitForSelector.value.trim();
    if (selector) body.waitForSelector = selector;
    draftInputs.scrape = url;
    nodes.commandInput.value = url;
    return { path: "/v1/scrape", body: body };
}

function buildSearchRequest(inputValue) {
    const numResults = clampNumber(nodes.searchLimit.value, 1, 50, 5);
    nodes.searchLimit.value = String(numResults);
    draftInputs.search = inputValue;
    return {
        path: "/v1/search",
        body: {
            query: inputValue,
            numResults: numResults,
            searchType: segmentValue(nodes.searchTypeGroup, "data-search-type") || "auto",
            includeHighlights: nodes.includeHighlights.checked,
        },
    };
}

async function postJson(path, body) {
    let response;
    try {
        response = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch {
        throw new Error("Could not reach the AirCrawl server.");
    }
    const payload = await readBody(response);
    if (!response.ok || payload.success === false) {
        throw new Error(messageFromPayload(payload, response.status));
    }
    return {
        payload: payload,
        serverTiming: response.headers.get("X-Response-Time") || "",
    };
}

async function readBody(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { detail: text.slice(0, 500) };
    }
}

function messageFromPayload(payload, statusCode) {
    if (payload && typeof payload.detail === "string" && payload.detail) return payload.detail;
    if (payload && Array.isArray(payload.detail)) {
        const parts = payload.detail.map((item) => item.msg || item.message || "").filter(Boolean);
        if (parts.length) return parts.join(" ");
    }
    if (payload && typeof payload.error === "string" && payload.error) return payload.error;
    return "Request failed (" + statusCode + ").";
}

function setRunning(isRunning) {
    appState.isRunning = isRunning;
    nodes.runBtn.disabled = isRunning;
    nodes.runBtn.classList.toggle("is-busy", isRunning);
    nodes.stage.classList.toggle("is-busy", isRunning);
    nodes.stage.setAttribute("aria-busy", String(isRunning));
    nodes.progressBar.hidden = !isRunning;
    if (isRunning) {
        const started = performance.now();
        const verb = currentMode === "scrape" ? "Scraping" : (currentMode === "search" ? "Searching" : "Parsing");
        nodes.runLabel.textContent = verb;
        appState.timerId = window.setInterval(() => {
            const seconds = ((performance.now() - started) / 1000).toFixed(1);
            nodes.runLabel.textContent = verb + " · " + seconds + "s";
        }, 100);
        return;
    }
    if (appState.timerId) {
        clearInterval(appState.timerId);
        appState.timerId = 0;
    }
    nodes.runLabel.textContent = currentMode === "scrape" ? "Run scrape" : (currentMode === "search" ? "Run search" : "Run parse");
}

function renderCurrent() {
    if (!appState.lastResponse) {
        renderEmpty();
        return;
    }
    if (appState.lastKind === "search") renderSearch(appState.lastResponse);
    else if (appState.lastKind === "parse") renderParse(appState.lastResponse);
    else renderScrape(appState.lastResponse);
    nodes.stage.scrollTop = 0;
    refreshIcons();
}

function renderEmpty() {
    appState.outputTab = "";
    nodes.stage.replaceChildren();
    const wrap = el("div", "empty");
    wrap.append(el("p", "eyebrow", "Playground"));
    wrap.append(el("h2", "", "Scrape pages, search the web, or extract typed JSON."));
    const lead = el("p", "empty-lead", "Load a sample, then run it. Scrape converts pages to markdown and HTML, Search explores via Exa, and Parse extracts structured JSON using Groq LLM inference.");
    const grid = el("div", "sample-grid");
    grid.append(
        sampleCard("static", "Scrape · static", "example.com", "A plain document. Auto should stay on HTTP."),
        sampleCard("spa", "Scrape · SPA", "zerodaily.in", "A client-rendered shell. Auto should fall back to the browser."),
        sampleCard("pricing", "Parse · JSON", "zerodaily.in", "Extract typed data conforming to a JSON Schema with Groq LLM."),
        sampleCard("query", "Search", "what is zerodaily.in", "A question for Exa. Open any hit in the scrape or parse view."),
    );
    wrap.append(lead, grid);
    nodes.stage.append(wrap);
    document.title = "AirCrawl";
}
    document.title = "AirCrawl";
}

function sampleCard(key, kicker, title, body) {
    const button = el("button", "sample");
    button.type = "button";
    button.dataset.sample = key;
    button.append(el("span", "sample-kicker", kicker), el("span", "sample-title", title), el("span", "sample-body", body));
    return button;
}

function renderScrape(scrapeResult) {
    const data = scrapeResult.data || {};
    const metadata = data.metadata || {};
    const metrics = scrapeResult.metrics || {};
    const notes = scrapeResult.historyNotes || {};
    const title = metadata.title || metadata.url || "Untitled page";
    const markdown = data.markdown || "";
    const links = Array.isArray(data.links) ? data.links : [];
    const requestedMode = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.mode : "";

    const article = el("article", "result");
    article.append(el("p", "result-kicker", "Scrape result"));
    article.append(el("h2", "result-title", title));
    if (metadata.description) article.append(el("p", "result-desc", metadata.description));
    if (metadata.url && safeHttpUrl(metadata.url)) {
        const urlLink = el("a", "result-url", metadata.url);
        urlLink.href = safeHttpUrl(metadata.url);
        urlLink.target = "_blank";
        urlLink.rel = "noreferrer noopener";
        article.append(urlLink);
    }

    const meta = el("div", "meta-row");
    meta.append(metaChip(String(metadata.statusCode || "—"), statusTone(metadata.statusCode)));
    meta.append(metaChip(engineLabel(requestedMode, metadata.engineUsed), ""));
    meta.append(metaChip(formatDuration(metrics.durationMs), ""));
    if (appState.lastTiming) meta.append(metaChip("HTTP " + appState.lastTiming, ""));
    if (markdown) meta.append(metaChip(formatCount(markdown.length, "char"), ""));
    if (links.length) meta.append(metaChip(formatCount(links.length, "link"), ""));
    article.append(meta);

    const noteText = historyNoteText(notes);
    if (noteText) article.append(el("p", "history-note", noteText));

    const tabs = [];
    if (markdown || "markdown" in data) tabs.push({ id: "preview", label: "Preview" });
    if (markdown || "markdown" in data) tabs.push({ id: "markdown", label: "Markdown" });
    if (typeof data.html === "string") tabs.push({ id: "html", label: "Clean HTML" });
    if (typeof data.rawHtml === "string") tabs.push({ id: "rawHtml", label: "Raw HTML" });
    if (links.length || "links" in data) tabs.push({ id: "links", label: "Links " + links.length });
    if (data.screenshot) tabs.push({ id: "screenshot", label: "Screenshot" });
    tabs.push({ id: "json", label: "JSON" });
    const activeTab = tabs.some((tab) => tab.id === "preview") ? "preview" : tabs[0].id;
    article.append(buildToolbar(tabs, activeTab));

    if (markdown || "markdown" in data) {
        const preview = el("div", "paper");
        preview.dataset.panel = "preview";
        preview.append(markdown ? renderMarkdown(markdown) : el("p", "", "No markdown in this response."));
        const raw = el("pre", "code-view");
        raw.dataset.panel = "markdown";
        raw.textContent = markdown || "";
        article.append(preview, raw);
    }
    if (typeof data.html === "string") article.append(codePanel("html", data.html));
    if (typeof data.rawHtml === "string") article.append(codePanel("rawHtml", data.rawHtml));
    if (links.length || "links" in data) article.append(buildLinksPanel(links));
    if (data.screenshot) article.append(buildScreenshotPanel(data.screenshot, title));
    article.append(buildJsonPanel(scrapeResult));

    nodes.stage.replaceChildren(article);
    showOutputTab(activeTab);
    document.title = trimTitle(title) + " · AirCrawl";
}

function renderSearch(searchResult) {
    const data = searchResult.data || {};
    const results = Array.isArray(data.results) ? data.results : [];
    const metrics = searchResult.metrics || {};
    const query = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.query : "Search";

    const article = el("article", "result");
    article.append(el("p", "result-kicker", "Search result"));
    article.append(el("h2", "result-title", results.length + " result" + (results.length === 1 ? "" : "s")));
    article.append(el("p", "result-desc", "Query: " + query));
    const meta = el("div", "meta-row");
    meta.append(metaChip("Exa", ""));
    meta.append(metaChip(formatDuration(metrics.durationMs), ""));
    if (appState.lastTiming) meta.append(metaChip("HTTP " + appState.lastTiming, ""));
    const searchType = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.searchType : "";
    if (searchType) meta.append(metaChip(searchType, ""));
    article.append(meta);

    const tabs = [
        { id: "results", label: "Results" },
        { id: "markdown", label: "Markdown" },
        { id: "json", label: "JSON" },
    ];
    article.append(buildToolbar(tabs, "results"));

    const list = el("div", "result-list");
    list.dataset.panel = "results";
    if (results.length === 0) {
        list.append(el("p", "result-desc", "Exa returned no results."));
    } else {
        results.forEach((item, index) => list.append(buildSearchCard(item, index)));
    }

    const markdown = buildSearchMarkdown(query, results);
    const raw = el("pre", "code-view");
    raw.dataset.panel = "markdown";
    raw.textContent = markdown;
    article.append(list, raw, buildJsonPanel(searchResult));
    nodes.stage.replaceChildren(article);
    showOutputTab("results");
    document.title = trimTitle(query) + " · AirCrawl";
}

function buildSearchCard(item, index) {
    const card = el("article", "result-card");
    const top = el("div", "result-card-top");
    const copy = el("div", "");
    const safeUrl = safeHttpUrl(item.url || "");
    copy.append(el("p", "domain", (index + 1).toString().padStart(2, "0") + "  ·  " + hostFromUrl(safeUrl) + metaTail(item)));
    const title = item.title || safeUrl || "Untitled result";
    if (safeUrl) {
        const link = el("a", "title-link", title);
        link.href = safeUrl;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        copy.append(link);
    } else {
        copy.append(el("p", "title-link", title));
    }
    const actions = el("div", "card-actions");
    if (safeUrl) {
        const scrapeButton = el("button", "text-btn", "Scrape");
        scrapeButton.type = "button";
        scrapeButton.dataset.scrapeUrl = safeUrl;

        const parseButton = el("button", "text-btn", "Parse");
        parseButton.type = "button";
        parseButton.dataset.parseUrl = safeUrl;

        actions.append(scrapeButton, parseButton);
    }
    top.append(copy, actions);
    card.append(top);
    const highlight = highlightText(item);
    if (highlight) card.append(el("p", "quote", highlight));
    return card;
}

function renderParse(parseResult) {
    const data = parseResult.data || {};
    const extracted = data.extracted;
    const metadata = data.metadata || {};
    const metrics = parseResult.metrics || {};
    const sourceUrl = metadata.sourceUrl || (appState.lastRequest && appState.lastRequest.body && appState.lastRequest.body.url) || "";
    const title = sourceUrl ? hostFromUrl(sourceUrl) : "Structured JSON Extraction";
    const prompt = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.prompt : "";

    const article = el("article", "result");
    article.append(el("p", "result-kicker", "Parse result"));
    article.append(el("h2", "result-title", title));
    if (prompt) {
        article.append(el("p", "result-desc", 'Prompt: "' + prompt + '"'));
    } else {
        article.append(el("p", "result-desc", "Schema-constrained extraction powered by Groq LLM inference."));
    }
    if (sourceUrl && safeHttpUrl(sourceUrl)) {
        const urlLink = el("a", "result-url", sourceUrl);
        urlLink.href = safeHttpUrl(sourceUrl);
        urlLink.target = "_blank";
        urlLink.rel = "noreferrer noopener";
        article.append(urlLink);
    }

    const meta = el("div", "meta-row");
    meta.append(metaChip(metadata.modelUsed || "Groq", "ok"));
    meta.append(metaChip(formatDuration(metrics.durationMs), ""));
    if (appState.lastTiming) meta.append(metaChip("HTTP " + appState.lastTiming, ""));
    if (metadata.promptTokens != null) meta.append(metaChip(formatCount(metadata.promptTokens, "prompt token"), ""));
    if (metadata.completionTokens != null) meta.append(metaChip(formatCount(metadata.completionTokens, "completion token"), ""));
    if (metadata.totalTokens != null) meta.append(metaChip(formatCount(metadata.totalTokens, "total token"), ""));
    article.append(meta);

    const tabs = [
        { id: "structured", label: "Structured JSON" },
        { id: "json", label: "Raw JSON" },
        { id: "stats", label: "Overview / Stats" },
    ];
    article.append(buildToolbar(tabs, "structured"));

    // Panel 1: Structured JSON
    const structuredPanel = el("div", "");
    structuredPanel.dataset.panel = "structured";
    const formattedHtml = formatJsonHtml(extracted);
    const codePre = el("pre", "code-view");
    codePre.innerHTML = formattedHtml;
    structuredPanel.append(codePre);

    // Panel 2: Raw JSON
    const jsonPanel = el("div", "");
    jsonPanel.dataset.panel = "json";
    const rawPre = el("pre", "code-view");
    rawPre.dataset.role = "json";
    rawPre.textContent = JSON.stringify(parseResult, null, 2);
    jsonPanel.append(rawPre);

    // Panel 3: Overview / Stats
    const statsPanel = el("div", "stats-container");
    statsPanel.dataset.panel = "stats";

    const statsGrid = el("div", "stats-grid");
    const durationSec = (metrics.durationMs || 0) / 1000;
    const tokensPerSec = durationSec > 0 && metadata.completionTokens ? Math.round(metadata.completionTokens / durationSec) : "—";

    statsGrid.append(
        statCard("Duration", formatDuration(metrics.durationMs), "End-to-end extraction time"),
        statCard("Total Tokens", String(metadata.totalTokens != null ? metadata.totalTokens.toLocaleString() : "—"), "Tokens consumed"),
        statCard("Prompt Tokens", String(metadata.promptTokens != null ? metadata.promptTokens.toLocaleString() : "—"), "Context input tokens"),
        statCard("Completion Tokens", String(metadata.completionTokens != null ? metadata.completionTokens.toLocaleString() : "—"), "Generated JSON tokens"),
        statCard("Throughput", tokensPerSec !== "—" ? tokensPerSec + " tok/s" : "—", "Token generation rate"),
        statCard("Model", metadata.modelUsed || "openai/gpt-oss-120b", "LLM inference model"),
    );

    const detailsBox = el("div", "paper", "");
    detailsBox.style.marginTop = "16px";
    const prose = el("div", "prose prose-neutral");
    let summaryHtml = "<h3>Extraction Overview</h3>";
    summaryHtml += "<p><strong>Source:</strong> " + (sourceUrl ? '<a href="' + safeHttpUrl(sourceUrl) + '" target="_blank">' + escapeHtml(sourceUrl) + '</a>' : "Direct Markdown Input") + "</p>";
    if (prompt) summaryHtml += "<p><strong>Natural Language Prompt:</strong> " + escapeHtml(prompt) + "</p>";
    if (appState.lastRequest && appState.lastRequest.body && appState.lastRequest.body.schema) {
        summaryHtml += "<p><strong>Target Schema:</strong> Schema provided (" + Object.keys(appState.lastRequest.body.schema.properties || {}).length + " top-level fields)</p>";
    }
    prose.innerHTML = summaryHtml;
    detailsBox.append(prose);

    statsPanel.append(statsGrid, detailsBox);

    article.append(structuredPanel, jsonPanel, statsPanel);
    nodes.stage.replaceChildren(article);
    showOutputTab("structured");
    document.title = trimTitle(title) + " · AirCrawl";
}

function statCard(label, value, subtext) {
    const card = el("div", "stat-card");
    card.append(el("p", "stat-label", label), el("p", "stat-value", value));
    if (subtext) card.append(el("p", "stat-sub", subtext));
    return card;
}

function formatJsonHtml(data) {
    const rawJson = JSON.stringify(data, null, 2);
    if (!rawJson) return "<em>Empty response</em>";
    const escaped = escapeHtml(rawJson);
    return escaped.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
            let className = "json-number";
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    className = "json-key";
                } else {
                    className = "json-string";
                }
            } else if (/true|false/.test(match)) {
                className = "json-boolean";
            } else if (/null/.test(match)) {
                className = "json-null";
            }
            return '<span class="' + className + '">' + match + "</span>";
        }
    );
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildToolbar(tabs, activeId) {
    const bar = el("div", "result-toolbar");
    const tabList = el("div", "tab-list");
    tabList.setAttribute("role", "tablist");
    tabs.forEach((tab) => {
        const button = el("button", "tab" + (tab.id === activeId ? " is-on" : ""), tab.label);
        button.type = "button";
        button.dataset.outputTab = tab.id;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(tab.id === activeId));
        tabList.append(button);
    });
    const actions = el("div", "toolbar-actions");
    actions.append(actionButton("copy", "Copy"), actionButton("download", "Download"), actionButton("curl", "Copy cURL"));
    bar.append(tabList, actions);
    return bar;
}

function actionButton(action, label) {
    const button = el("button", "text-btn", label);
    button.type = "button";
    button.dataset.action = action;
    return button;
}

function showOutputTab(tabId) {
    appState.outputTab = tabId;
    nodes.stage.querySelectorAll("[data-output-tab]").forEach((button) => {
        const on = button.dataset.outputTab === tabId;
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-selected", String(on));
    });
    nodes.stage.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tabId;
    });
}

function codePanel(panelId, content) {
    const pre = el("pre", "code-view");
    pre.dataset.panel = panelId;
    pre.textContent = content;
    return pre;
}

function buildLinksPanel(links) {
    const panel = el("div", "");
    panel.dataset.panel = "links";
    const tools = el("div", "link-tools");
    const filter = document.createElement("input");
    filter.id = "linkFilter";
    filter.className = "field-input";
    filter.type = "text";
    filter.placeholder = "Filter links";
    filter.setAttribute("aria-label", "Filter links");
    const count = el("span", "field-hint", links.length + " links");
    count.id = "linkFilterCount";
    tools.append(filter, count);
    const list = el("ul", "link-list");
    const empty = el("p", "panel-note", "No links match that filter.");
    empty.id = "linkFilterEmpty";
    empty.hidden = true;
    links.slice(0, 400).forEach((linkUrl, index) => {
        const row = el("li", "link-row");
        row.dataset.href = linkUrl;
        row.append(el("span", "link-index", String(index + 1)));
        const safeUrl = safeHttpUrl(linkUrl);
        if (safeUrl) {
            const anchor = el("a", "", linkUrl);
            anchor.href = safeUrl;
            anchor.target = "_blank";
            anchor.rel = "noreferrer noopener";
            row.append(anchor);
        } else {
            row.append(el("span", "", linkUrl));
        }
        const copyButton = el("button", "text-btn", "Copy");
        copyButton.type = "button";
        copyButton.dataset.action = "copy-link";
        copyButton.dataset.copyLink = linkUrl;
        row.append(copyButton);
        list.append(row);
    });
    panel.append(tools, empty, list);
    if (links.length > 400) panel.append(el("p", "panel-note", "Showing the first 400 of " + links.length + " links."));
    if (links.length === 0) panel.append(el("p", "panel-note", "No links in this response."));
    return panel;
}

function buildScreenshotPanel(screenshotValue, title) {
    const panel = el("div", "shot-frame");
    panel.dataset.panel = "screenshot";
    const source = screenshotSource(screenshotValue);
    if (!source) {
        panel.append(el("p", "panel-note", "Screenshot data was empty."));
        return panel;
    }
    const image = document.createElement("img");
    image.src = source;
    image.alt = title ? "Screenshot of " + title : "Page screenshot";
    panel.append(image);
    return panel;
}

function buildJsonPanel(responseBody) {
    const panel = el("div", "");
    panel.dataset.panel = "json";
    const note = el("p", "panel-note", "Large HTML and screenshot bytes are shortened in this view.");
    const pre = el("pre", "code-view");
    pre.dataset.role = "json";
    pre.textContent = buildDisplayJson(responseBody);
    panel.append(note, pre);
    return panel;
}

function filterLinkRows(query) {
    const needle = query.trim().toLowerCase();
    const rows = [...nodes.stage.querySelectorAll(".link-row")];
    let visible = 0;
    rows.forEach((row) => {
        const href = (row.dataset.href || "").toLowerCase();
        const match = !needle || href.includes(needle);
        row.hidden = !match;
        if (match) visible += 1;
    });
    const empty = document.getElementById("linkFilterEmpty");
    const count = document.getElementById("linkFilterCount");
    if (empty) empty.hidden = visible !== 0;
    if (count) count.textContent = visible + " of " + rows.length;
}

function activeText() {
    const panel = nodes.stage.querySelector("[data-panel='" + appState.outputTab + "']");
    if (!panel) return "";
    if (appState.outputTab === "structured") {
        const data = appState.lastResponse && appState.lastResponse.data ? appState.lastResponse.data.extracted : null;
        return data != null ? JSON.stringify(data, null, 2) : "";
    }
    if (appState.outputTab === "json") {
        const pre = panel.querySelector("[data-role='json']");
        return pre ? pre.textContent : (appState.lastResponse ? JSON.stringify(appState.lastResponse, null, 2) : "");
    }
    if (appState.outputTab === "stats") {
        return panel.innerText || panel.textContent || "";
    }
    if (appState.outputTab === "links") {
        return [...panel.querySelectorAll(".link-row:not([hidden])")]
            .map((row) => row.dataset.href || "")
            .filter(Boolean)
            .join("\n");
    }
    if (appState.outputTab === "results") return buildSearchMarkdownFromState();
    if (appState.outputTab === "preview" || appState.outputTab === "markdown") {
        const raw = nodes.stage.querySelector("[data-panel='markdown']");
        return raw ? raw.textContent : "";
    }
    return panel.textContent || "";
}

async function copyActiveContent(button) {
    await copyText(activeText(), button);
}

async function copyCurl(button) {
    if (!appState.lastRequest) return;
    const origin = window.location.origin;
    const command = [
        "curl -s " + shellSingleQuote(origin + appState.lastRequest.path),
        "  -H " + shellSingleQuote("Content-Type: application/json"),
        "  -d " + shellSingleQuote(JSON.stringify(appState.lastRequest.body)),
    ].join(" \\\n");
    await copyText(command, button);
}

function downloadActiveContent() {
    const tab = appState.outputTab;
    const slug = fileSlug();
    if (tab === "screenshot") {
        const data = appState.lastResponse && appState.lastResponse.data;
        const source = data ? screenshotSource(data.screenshot) : "";
        if (!source) return;
        const anchor = document.createElement("a");
        anchor.href = source;
        anchor.download = slug + ".png";
        anchor.click();
        return;
    }
    if (tab === "structured") {
        downloadBlob(slug + "-extracted.json", activeText(), "application/json");
        return;
    }
    if (tab === "json") {
        downloadBlob(slug + ".json", activeText(), "application/json");
        return;
    }
    if (tab === "stats") {
        downloadBlob(slug + "-stats.txt", activeText(), "text/plain");
        return;
    }
    if (tab === "html" || tab === "rawHtml") {
        downloadBlob(slug + ".html", activeText(), "text/html");
        return;
    }
    if (tab === "links") {
        downloadBlob(slug + "-links.txt", activeText(), "text/plain");
        return;
    }
    downloadBlob(slug + ".md", activeText(), "text/markdown");
}

async function copyText(text, button) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        showError("Clipboard is not available in this browser.");
        return;
    }
    if (!button) return;
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => {
        button.textContent = original;
    }, 1400);
}

function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function fileSlug() {
    if (appState.lastKind === "search") {
        const query = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.query : "search";
        return slugify(query) || "search";
    }
    if (appState.lastKind === "parse") {
        const url = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.url : "";
        if (url) return slugify(hostFromUrl(url) || "parse") || "parse";
        return "parsed-data";
    }
    const url = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.url : "";
    return slugify(hostFromUrl(url) || "page") || "page";
}

function rememberRun(request, payload, serverTiming) {
    let label = "";
    if (currentMode === "scrape") {
        label = request.body.url;
    } else if (currentMode === "search") {
        label = request.body.query;
    } else if (currentMode === "parse") {
        label = request.body.url || (request.body.prompt ? "MD: " + request.body.prompt : "Markdown parse");
    }
    const record = {
        id: String(Date.now()),
        at: Date.now(),
        mode: currentMode,
        label: label,
        request: request,
        response: trimForHistory(currentMode, payload),
        serverTiming: serverTiming,
    };
    appState.history = [record, ...appState.history.filter((item) => item.label !== record.label || item.mode !== record.mode)].slice(0, historyLimit);
    persistHistory();
    return record;
}

function trimForHistory(kind, payload) {
    if (kind === "search" || kind === "parse") return payload;
    const data = payload.data || {};
    const markdown = typeof data.markdown === "string" ? data.markdown : "";
    const trimmed = markdown.length > markdownHistoryLimit;
    const trimmedData = { metadata: data.metadata };
    if (typeof data.markdown === "string") {
        trimmedData.markdown = trimmed
            ? markdown.slice(0, markdownHistoryLimit) + "\n\n…[truncated in session history]"
            : markdown;
    }
    if (Array.isArray(data.links)) trimmedData.links = data.links.slice(0, 300);
    return {
        success: payload.success,
        metrics: payload.metrics,
        error: payload.error,
        historyNotes: {
            omittedHtml: typeof data.html === "string" || typeof data.rawHtml === "string",
            omittedScreenshot: Boolean(data.screenshot),
            markdownTruncated: trimmed,
        },
        data: trimmedData,
    };
}

function shellSingleQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function historyNoteText(notes) {
    const parts = [];
    if (notes.markdownTruncated) parts.push("Markdown was shortened in session history.");
    if (notes.omittedHtml) parts.push("HTML is not kept in session history.");
    if (notes.omittedScreenshot) parts.push("The screenshot is not kept in session history.");
    return parts.join(" ");
}

function restoreHistory(historyId) {
    const record = appState.history.find((item) => item.id === historyId);
    if (!record) return;
    setMode(record.mode);
    applyRequestToForm(record.request.body, record.mode);
    appState.lastRequest = record.request;
    appState.lastResponse = record.response;
    appState.lastKind = record.mode;
    appState.lastTiming = record.serverTiming || "";
    appState.activeHistoryId = record.id;
    renderHistory();
    renderCurrent();
    setStatus("Restored a run from this session.");
}

function applyRequestToForm(body, mode) {
    if (mode === "scrape") {
        nodes.commandInput.value = body.url || "";
        draftInputs.scrape = nodes.commandInput.value;
        selectEngine(body.mode || "auto");
        nodes.formatChips.querySelectorAll("[data-format]").forEach((button) => {
            const on = Array.isArray(body.formats) && body.formats.includes(button.dataset.format);
            button.setAttribute("aria-pressed", String(on));
            button.classList.toggle("is-on", on);
        });
        nodes.waitForSelector.value = body.waitForSelector || "";
        nodes.timeoutMs.value = String(body.timeoutMs || 30000);
        if (body.waitForSelector) {
            nodes.advancedPanel.hidden = false;
            nodes.advancedToggle.setAttribute("aria-expanded", "true");
        }
        updateScreenshotHint();
        return;
    }
    if (mode === "search") {
        nodes.commandInput.value = body.query || "";
        draftInputs.search = nodes.commandInput.value;
        nodes.searchLimit.value = String(body.numResults || 5);
        selectSearchType(body.searchType || "auto");
        nodes.includeHighlights.checked = body.includeHighlights !== false;
        return;
    }
    if (mode === "parse") {
        if (body.url) {
            selectParseSource("url");
            nodes.commandInput.value = body.url;
            draftInputs.parse = body.url;
        } else if (body.markdown) {
            selectParseSource("markdown");
            nodes.parseMarkdownInput.value = body.markdown;
        }
        nodes.parsePrompt.value = body.prompt || "";
        nodes.parseSchema.value = body.schema ? JSON.stringify(body.schema, null, 2) : "";
        selectParseModel(body.model || "openai/gpt-oss-120b");
        updateSchemaValidation();
    }
}

function loadHistory() {
    try {
        const raw = sessionStorage.getItem(historyStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        appState.history = Array.isArray(parsed) ? parsed : [];
    } catch {
        appState.history = [];
    }
}

function persistHistory() {
    const save = () => sessionStorage.setItem(historyStorageKey, JSON.stringify(appState.history));
    try {
        save();
    } catch {
        appState.history = appState.history.slice(0, 4);
        try {
            save();
        } catch {
            appState.history = [];
        }
    }
}

function renderHistory() {
    nodes.historyList.replaceChildren();
    nodes.historyEmpty.hidden = appState.history.length !== 0;
    nodes.clearHistoryBtn.disabled = appState.history.length === 0;
    appState.history.forEach((record) => {
        const button = el("button", "history-item" + (record.id === appState.activeHistoryId ? " is-active" : ""));
        button.type = "button";
        button.dataset.historyId = record.id;
        const time = el("span", "history-time", formatAge(record.at));
        button.append(el("span", "pill", record.mode), time, el("span", "history-label", record.label));
        nodes.historyList.append(button);
    });
}

function clearHistory() {
    appState.history = [];
    appState.activeHistoryId = "";
    persistHistory();
    renderHistory();
}

async function checkBackendHealth() {
    try {
        const response = await fetch("/health");
        const healthData = await response.json();
        if (!response.ok || healthData.status !== "healthy") throw new Error("unhealthy");
        nodes.healthBadge.dataset.state = "online";
        nodes.healthLabel.textContent = "API online";
        const modules = Array.isArray(healthData.activeModules) ? healthData.activeModules.join(", ") : "";
        nodes.healthBadge.title = modules ? "Active: " + modules : "API online";
    } catch {
        nodes.healthBadge.dataset.state = "offline";
        nodes.healthLabel.textContent = "API offline";
        nodes.healthBadge.title = "The API did not respond";
    }
}

function renderMarkdown(markdownText) {
    const source = markdownText || "";
    if (!window.marked || typeof window.marked.parse !== "function") {
        return el("pre", "code-view", source);
    }
    let html = "";
    try {
        html = window.marked.parse(source);
    } catch {
        return el("pre", "code-view", source);
    }
    const wrapper = el("div", "prose prose-neutral");
    wrapper.innerHTML = sanitizeHtml(html);
    wrapper.querySelectorAll("a[href]").forEach((anchor) => {
        if (safeHttpUrl(anchor.getAttribute("href") || "")) {
            anchor.target = "_blank";
            anchor.rel = "noreferrer noopener";
        }
    });
    return wrapper;
}

const blockedTags = new Set(["script", "iframe", "object", "embed", "link", "meta", "base", "form", "style", "frame", "frameset"]);

function sanitizeHtml(htmlString) {
    const template = document.createElement("template");
    template.innerHTML = htmlString;
    template.content.querySelectorAll("*").forEach((node) => {
        if (blockedTags.has(node.tagName.toLowerCase())) {
            node.remove();
            return;
        }
        [...node.attributes].forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value || "";
            if (name.startsWith("on") || name === "style" || name === "srcdoc") {
                node.removeAttribute(attribute.name);
                return;
            }
            if (name === "href" && !isSafeHref(value)) node.removeAttribute(attribute.name);
            if (name === "src" && !safeHttpUrl(value)) node.removeAttribute(attribute.name);
        });
    });
    return template.innerHTML;
}

function buildDisplayJson(responseBody) {
    const data = responseBody.data ? { ...responseBody.data } : responseBody.data;
    if (data && typeof data.screenshot === "string") {
        data.screenshot = "[omitted base64, " + data.screenshot.length + " characters]";
    }
    ["html", "rawHtml", "markdown"].forEach((key) => {
        if (data && typeof data[key] === "string" && data[key].length > 30000) {
            data[key] = data[key].slice(0, 30000) + "\n…[" + data[key].length + " characters total]";
        }
    });
    return JSON.stringify({ ...responseBody, data: data }, null, 2);
}

function buildSearchMarkdown(query, results) {
    let markdown = "# Search results\n\nQuery: **" + query.replace(/\*/g, "") + "**\n\nFound **" + results.length + "** results.\n\n";
    results.forEach((item, index) => {
        const title = item.title || item.url || "Untitled";
        const url = safeHttpUrl(item.url || "");
        markdown += "### " + (index + 1) + ". " + (url ? "[" + title + "](" + url + ")" : title) + "\n\n";
        const highlight = highlightText(item);
        if (highlight) markdown += "> " + highlight.replace(/\n/g, " ") + "\n\n";
    });
    return markdown;
}

function buildSearchMarkdownFromState() {
    const data = appState.lastResponse && appState.lastResponse.data ? appState.lastResponse.data : {};
    const results = Array.isArray(data.results) ? data.results : [];
    const query = appState.lastRequest && appState.lastRequest.body ? appState.lastRequest.body.query : "";
    return buildSearchMarkdown(query, results);
}

function screenshotSource(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const trimmed = value.trim();
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return "";
    return "data:image/png;base64," + trimmed.replace(/\s/g, "");
}

function engineLabel(requestedMode, engineUsed) {
    if (requestedMode === "auto" && engineUsed === "browser") return "Auto · browser fallback";
    if (requestedMode === "auto" && engineUsed === "http") return "Auto · HTTP";
    if (engineUsed === "browser") return "Browser";
    if (engineUsed === "http") return "HTTP";
    return engineUsed || requestedMode || "Engine";
}

function statusTone(statusCode) {
    const number = Number(statusCode);
    if (!number) return "";
    if (number >= 400) return "danger";
    if (number >= 300) return "warn";
    return "ok";
}

function metaChip(text, tone) {
    return el("span", "meta-chip" + (tone ? " " + tone : ""), text);
}

function highlightText(item) {
    const value = item && item.highlights;
    if (Array.isArray(value)) return value.filter(Boolean).join(" ");
    if (typeof value === "string") return value;
    return "";
}

function metaTail(item) {
    const parts = [];
    if (item && item.author) parts.push(item.author);
    const when = formatWhen(item && item.publishedDate);
    if (when) parts.push(when);
    return parts.length ? "  ·  " + parts.join(" · ") : "";
}

function hostFromUrl(url) {
    try {
        return new URL(url).host;
    } catch {
        return "";
    }
}

function normalizeUrl(value) {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) return "https://" + trimmed;
    return trimmed;
}

function safeHttpUrl(value) {
    const trimmed = (value || "").trim();
    if (!/^https?:\/\//i.test(trimmed)) return "";
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch {
        return "";
    }
    return "";
}

function isSafeHref(value) {
    const trimmed = (value || "").trim();
    if (!trimmed || trimmed.startsWith("//")) return false;
    if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
    if (/^(mailto|tel):/i.test(trimmed)) return !/[\r\n]/.test(trimmed);
    return Boolean(safeHttpUrl(trimmed));
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function formatDuration(durationMs) {
    const value = Number(durationMs);
    if (!Number.isFinite(value)) return "—";
    if (value < 1000) return Math.round(value) + " ms";
    return (value / 1000).toFixed(2) + " s";
}

function formatCount(count, noun) {
    const rounded = Math.round(count);
    const label = rounded === 1 ? noun : noun + "s";
    return rounded.toLocaleString() + " " + label;
}

function formatWhen(isoValue) {
    if (!isoValue) return "";
    const parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatAge(timestamp) {
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return seconds + "s ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return new Date(timestamp).toLocaleDateString();
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

function trimTitle(value) {
    const text = String(value || "AirCrawl");
    return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

function showError(message) {
    nodes.errorBanner.hidden = false;
    nodes.errorBanner.textContent = message;
    setStatus(message);
}

function hideError() {
    nodes.errorBanner.hidden = true;
    nodes.errorBanner.textContent = "";
}

function setStatus(message) {
    nodes.statusLine.textContent = message;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}
