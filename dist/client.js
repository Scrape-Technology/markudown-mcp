const DEFAULT_BASE_URL = "https://api.scrapetechnology.com";
const DEFAULT_TIMEOUT = 120_000;
const POLL_INTERVAL = 2_000;
export class ScrapeTechnologyClientError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = "ScrapeTechnologyClientError";
        this.statusCode = statusCode;
    }
}
export class ScrapeTechnologyClient {
    apiKey;
    baseUrl;
    timeout;
    constructor(opts) {
        this.apiKey = opts.apiKey;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    }
    async _request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json",
        };
        const resp = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "Unknown error");
            throw new ScrapeTechnologyClientError(`API returned ${resp.status}: ${text}`, resp.status);
        }
        return resp.json();
    }
    async _pollJob(queue, jobId) {
        while (true) {
            const status = await this._request("GET", `/api/${queue}/${jobId}`);
            if (status.status === "completed")
                return status;
            if (status.status === "failed") {
                throw new ScrapeTechnologyClientError(status.error ?? "Job failed");
            }
            if (status.status === "not_found") {
                throw new ScrapeTechnologyClientError(`Job ${jobId} not found`);
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        }
    }
    async scrape(url, opts = {}) {
        return this._request("POST", "/api/scrape", {
            url: [url],
            timeout: opts.timeout ?? 60,
            exclude_tags: opts.excludeTags ?? ["header", "nav", "footer"],
            main_content: opts.mainContent ?? true,
            include_link: opts.includeLinks ?? false,
            include_html: opts.includeHtml ?? false,
            formats: opts.formats,
        });
    }
    async map(url, opts = {}) {
        return this._request("POST", "/api/map", {
            url: [url],
            allowed_words: opts.allowedWords ?? [],
            blocked_words: opts.blockedWords ?? [],
            max_urls: opts.maxUrls ?? 1000,
        });
    }
    async screenshot(url, opts = {}) {
        return this._request("POST", "/api/screenshot", {
            url: [url],
            timeout: opts.timeout ?? 60,
        });
    }
    async crawl(url, opts = {}) {
        const result = await this._request("POST", "/api/crawl", {
            url: [url],
            max_depth: opts.maxDepth ?? 2,
            limit: opts.limit ?? 10,
            timeout: opts.timeout ?? 60,
            include_link: opts.includeLinks ?? false,
            include_html: opts.includeHtml ?? false,
            exclude_tags: opts.excludeTags,
            blocked_words: opts.blockedWords,
            include_only: opts.includeOnly,
            main_content: opts.mainContent ?? true,
        });
        return this._pollJob("crawl", result.id);
    }
    async search(query, opts = {}) {
        const result = await this._request("POST", "/api/search", {
            query,
            limit: opts.limit ?? 5,
            scrape_results: opts.scrapeResults ?? true,
            lang: opts.lang ?? "en",
            country: opts.country ?? "us",
            timeout: opts.timeout ?? 60,
        });
        return this._pollJob("search", result.id);
    }
    async extract(url, prompt, opts = {}) {
        const result = await this._request("POST", "/api/prompt-extract", {
            url,
            prompt,
            timeout: opts.timeout ?? 60,
        });
        return this._pollJob("extract", result.id);
    }
    async batchScrape(urls, opts = {}) {
        const result = await this._request("POST", "/api/batch-scrape", {
            url: urls,
            timeout: opts.timeout ?? 60,
        });
        return this._pollJob("batch-scrape", result.id);
    }
    async deepResearch(query, urls, opts = {}) {
        const result = await this._request("POST", "/api/deep-research", {
            query,
            urls,
            max_tokens: opts.maxTokens ?? 4096,
            timeout: opts.timeout ?? 180,
        });
        return this._pollJob("deep-research", result.id);
    }
    async agent(url, prompt, opts = {}) {
        const result = await this._request("POST", "/api/agent", {
            url,
            prompt,
            max_steps: opts.maxSteps ?? 10,
            max_pages: opts.maxPages ?? 5,
            allow_navigation: opts.allowNavigation ?? true,
            include_screenshots: opts.includeScreenshots ?? false,
            timeout: opts.timeout ?? 120,
        });
        return this._pollJob("agent", result.id);
    }
    async changeDetection(url, opts = {}) {
        return this._request("POST", "/api/change-detection", {
            url: [url],
            timeout: opts.timeout ?? 60,
            main_content: opts.mainContent ?? true,
            exclude_tags: opts.excludeTags ?? ["header", "nav", "footer"],
        });
    }
}
//# sourceMappingURL=client.js.map