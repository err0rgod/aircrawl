// AirCrawl Frontend Logic with strict camelCase naming

let currentMode = "scrape";
let activeOutputTab = "markdown";
let lastResponseData = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    checkBackendHealth();
});

async function checkBackendHealth() {
    try {
        const response = await fetch("/health");
        const healthData = await response.json();
        const badgeElement = document.getElementById("backendStatusBadge");
        if (healthData.status === "healthy") {
            badgeElement.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs";
            badgeElement.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>API Online</span>`;
        }
    } catch {
        const badgeElement = document.getElementById("backendStatusBadge");
        badgeElement.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs";
        badgeElement.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span>API Offline</span>`;
    }
}

function switchMainTab(selectedMode) {
    currentMode = selectedMode;

    const tabScrapeBtn = document.getElementById("tabScrapeBtn");
    const tabSearchBtn = document.getElementById("tabSearchBtn");
    const scrapeOptionsRow = document.getElementById("scrapeOptionsRow");
    const searchOptionsRow = document.getElementById("searchOptionsRow");
    const primaryInput = document.getElementById("primaryInput");
    const submitBtnText = document.getElementById("submitBtnText");
    const inputIcon = document.getElementById("inputIcon");

    if (selectedMode === "scrape") {
        tabScrapeBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold transition bg-sky-500 text-white shadow-md shadow-sky-500/20 flex items-center gap-2";
        tabSearchBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold transition text-slate-600 hover:bg-sky-50 flex items-center gap-2";
        scrapeOptionsRow.classList.remove("hidden");
        searchOptionsRow.classList.add("hidden");
        primaryInput.placeholder = "https://zerodaily.in";
        primaryInput.value = "https://zerodaily.in";
        submitBtnText.textContent = "Execute Scrape";
        inputIcon.setAttribute("data-lucide", "globe");
    } else {
        tabSearchBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold transition bg-sky-500 text-white shadow-md shadow-sky-500/20 flex items-center gap-2";
        tabScrapeBtn.className = "px-4 py-2 rounded-xl text-sm font-semibold transition text-slate-600 hover:bg-sky-50 flex items-center gap-2";
        searchOptionsRow.classList.remove("hidden");
        scrapeOptionsRow.classList.add("hidden");
        primaryInput.placeholder = "Search query (e.g. latest tech breakthroughs)";
        primaryInput.value = "what is zerodaily.in";
        submitBtnText.textContent = "Execute Search";
        inputIcon.setAttribute("data-lucide", "search");
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function setSampleUrl(targetUrl) {
    document.getElementById("primaryInput").value = targetUrl;
    if (currentMode !== "scrape") {
        switchMainTab("scrape");
    }
}

async function handleExecute(formSubmitEvent) {
    formSubmitEvent.preventDefault();

    const inputValue = document.getElementById("primaryInput").value.trim();
    if (!inputValue) return;

    const submitBtn = document.getElementById("submitBtn");
    const submitBtnText = document.getElementById("submitBtnText");
    const resultsDeck = document.getElementById("resultsDeck");

    submitBtn.disabled = true;
    submitBtnText.textContent = "Processing...";

    const startTime = performance.now();

    try {
        if (currentMode === "scrape") {
            await executeScrapeRequest(inputValue);
        } else {
            await executeSearchRequest(inputValue);
        }
        resultsDeck.classList.remove("hidden");
    } catch (requestError) {
        alert("Request failed: " + requestError.message);
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = currentMode === "scrape" ? "Execute Scrape" : "Execute Search";
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

async function executeScrapeRequest(targetUrl) {
    const selectedFormats = [];
    if (document.getElementById("fmtMarkdown").checked) selectedFormats.push("markdown");
    if (document.getElementById("fmtHtml").checked) selectedFormats.push("html");
    if (document.getElementById("fmtLinks").checked) selectedFormats.push("links");
    if (document.getElementById("fmtScreenshot").checked) selectedFormats.push("screenshot");

    const selectedEngine = document.getElementById("engineModeSelect").value;

    const payload = {
        url: targetUrl,
        mode: selectedEngine,
        formats: selectedFormats,
    };

    const response = await fetch("/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const responseJson = await response.json();
    lastResponseData = responseJson;

    if (!responseJson.success) {
        throw new Error(responseJson.error || "Scrape operation returned an error.");
    }

    renderScrapeResults(responseJson);
}

async function executeSearchRequest(searchQuery) {
    const resultsLimit = parseInt(document.getElementById("searchLimitSelect").value, 10);

    const payload = {
        query: searchQuery,
        numResults: resultsLimit,
    };

    const response = await fetch("/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const responseJson = await response.json();
    lastResponseData = responseJson;

    if (!responseJson.success) {
        throw new Error(responseJson.error || "Search operation returned an error.");
    }

    renderSearchResults(responseJson);
}

function renderScrapeResults(scrapeResult) {
    const resultData = scrapeResult.data || {};
    const metadata = resultData.metadata || {};
    const metrics = scrapeResult.metrics || {};

    // 1. Update Metrics Badges
    document.getElementById("metricStatusBadge").textContent = `${metadata.statusCode || 200} OK`;
    document.getElementById("metricEngineBadge").textContent = `Engine: ${metadata.engineUsed || "auto"}`;
    document.getElementById("metricDurationText").textContent = `${metrics.durationMs || 0}ms`;

    // 2. Render Markdown
    const markdownContent = resultData.markdown || "_No markdown returned._";
    document.getElementById("contentRendered").innerHTML = marked.parse(markdownContent);
    document.getElementById("contentRawMarkdown").textContent = markdownContent;

    // 3. Render JSON
    document.getElementById("contentJson").textContent = JSON.stringify(scrapeResult, null, 2);

    // 4. Render Links
    const linksList = resultData.links || [];
    document.getElementById("linksCountText").textContent = linksList.length;
    const linksContainer = document.getElementById("linksListContainer");
    linksContainer.innerHTML = "";

    if (linksList.length === 0) {
        linksContainer.innerHTML = '<li class="py-2 text-slate-400">No links extracted.</li>';
    } else {
        linksList.forEach((linkUrl) => {
            const listItem = document.createElement("li");
            listItem.className = "py-2 flex items-center justify-between text-slate-700 hover:text-sky-600";
            listItem.innerHTML = `<a href="${linkUrl}" target="_blank" class="truncate hover:underline">${linkUrl}</a>`;
            linksContainer.appendChild(listItem);
        });
    }

    // 5. Render Screenshot (if present)
    const screenshotTabBtn = document.getElementById("viewTabScreenshot");
    if (resultData.screenshot) {
        screenshotTabBtn.classList.remove("hidden");
        document.getElementById("screenshotImage").src = `data:image/png;base64,${resultData.screenshot}`;
    } else {
        screenshotTabBtn.classList.add("hidden");
    }

    // Default to markdown preview
    switchOutputTab("markdown");
}

function renderSearchResults(searchResult) {
    const resultData = searchResult.data || {};
    const resultsList = resultData.results || [];
    const metrics = searchResult.metrics || {};

    document.getElementById("metricStatusBadge").textContent = "200 OK";
    document.getElementById("metricEngineBadge").textContent = "Engine: Exa";
    document.getElementById("metricDurationText").textContent = `${metrics.durationMs || 0}ms`;

    // Build synthesized markdown from search results
    let syntheticMarkdown = `# Search Results for Query\n\nFound **${resultsList.length}** results:\n\n`;
    resultsList.forEach((item, index) => {
        syntheticMarkdown += `### ${index + 1}. [${item.title}](${item.url})\n\n`;
        if (item.highlights && item.highlights.length > 0) {
            syntheticMarkdown += `> ${item.highlights.join(" ... ")}\n\n`;
        }
    });

    document.getElementById("contentRendered").innerHTML = marked.parse(syntheticMarkdown);
    document.getElementById("contentRawMarkdown").textContent = syntheticMarkdown;
    document.getElementById("contentJson").textContent = JSON.stringify(searchResult, null, 2);

    // Links
    document.getElementById("linksCountText").textContent = resultsList.length;
    const linksContainer = document.getElementById("linksListContainer");
    linksContainer.innerHTML = "";
    resultsList.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.className = "py-2 flex items-center justify-between text-slate-700";
        listItem.innerHTML = `<a href="${item.url}" target="_blank" class="truncate hover:underline text-sky-600 font-medium">${item.title}</a>`;
        linksContainer.appendChild(listItem);
    });

    document.getElementById("viewTabScreenshot").classList.add("hidden");
    switchOutputTab("markdown");
}

function switchOutputTab(targetTab) {
    activeOutputTab = targetTab;

    const allTabs = ["markdown", "rawMarkdown", "json", "links", "screenshot"];
    allTabs.forEach((tabName) => {
        const tabBtn = document.getElementById(`viewTab${capitalizeFirstLetter(tabName)}`);
        const contentPanel = document.getElementById(`content${capitalizeFirstLetter(tabName)}`);

        if (tabBtn && contentPanel) {
            if (tabName === targetTab) {
                tabBtn.className = "px-3 py-2 border-b-2 border-sky-500 text-sky-600 font-semibold transition";
                contentPanel.classList.remove("hidden");
            } else {
                tabBtn.className = "px-3 py-2 border-b-2 border-transparent hover:text-slate-900 transition";
                contentPanel.classList.add("hidden");
            }
        }
    });
}

function capitalizeFirstLetter(stringVal) {
    return stringVal.charAt(0).toUpperCase() + stringVal.slice(1);
}

async function copyActiveContent() {
    if (!lastResponseData) return;

    let contentToCopy = "";
    if (activeOutputTab === "markdown" || activeOutputTab === "rawMarkdown") {
        contentToCopy = document.getElementById("contentRawMarkdown").textContent;
    } else if (activeOutputTab === "json") {
        contentToCopy = document.getElementById("contentJson").textContent;
    } else if (activeOutputTab === "links") {
        const links = lastResponseData.data?.links || [];
        contentToCopy = links.join("\n");
    }

    try {
        await navigator.clipboard.writeText(contentToCopy);
        const copyBtnText = document.getElementById("copyBtnText");
        copyBtnText.textContent = "Copied!";
        setTimeout(() => {
            copyBtnText.textContent = "Copy";
        }, 2000);
    } catch {
        alert("Failed to copy to clipboard.");
    }
}
