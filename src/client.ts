const DEFAULT_BASE_URL = "https://api.scrapetechnology.com";
const DEFAULT_TIMEOUT = 120_000;
const POLL_INTERVAL = 2_000;

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface JobResponse {
  success: boolean;
  id: string;
  url: string;
}

export interface JobStatus {
  success: boolean;
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "not_found";
  data?: unknown;
  error?: string;
  progress?: unknown;
}

export class ScrapeTechnologyClientError extends Error {
  public statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ScrapeTechnologyClientError";
    this.statusCode = statusCode;
  }
}

export class ScrapeTechnologyClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(opts: ClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  }

  private async _request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
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
      throw new ScrapeTechnologyClientError(
        `API returned ${resp.status}: ${text}`,
        resp.status,
      );
    }

    return resp.json() as Promise<T>;
  }

  private async _pollJob(queue: string, jobId: string): Promise<JobStatus> {
    while (true) {
      const status = await this._request<JobStatus>("GET", `/api/${queue}/${jobId}`);

      if (status.status === "completed") return status;
      if (status.status === "failed") {
        throw new ScrapeTechnologyClientError(status.error ?? "Job failed");
      }
      if (status.status === "not_found") {
        throw new ScrapeTechnologyClientError(`Job ${jobId} not found`);
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }

  async scrape(
    url: string,
    opts: {
      timeout?: number;
      excludeTags?: string[];
      mainContent?: boolean;
      includeLinks?: boolean;
      includeHtml?: boolean;
      formats?: ("markdown" | "summary")[];
    } = {},
  ): Promise<unknown> {
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

  async map(
    url: string,
    opts: {
      allowedWords?: string[];
      blockedWords?: string[];
      maxUrls?: number;
    } = {},
  ): Promise<unknown> {
    return this._request("POST", "/api/map", {
      url: [url],
      allowed_words: opts.allowedWords ?? [],
      blocked_words: opts.blockedWords ?? [],
      max_urls: opts.maxUrls ?? 1000,
    });
  }

  async screenshot(
    url: string,
    opts: { timeout?: number } = {},
  ): Promise<unknown> {
    return this._request("POST", "/api/screenshot", {
      url: [url],
      timeout: opts.timeout ?? 60,
    });
  }

  async crawl(
    url: string,
    opts: {
      maxDepth?: number;
      limit?: number;
      timeout?: number;
      includeLinks?: boolean;
      includeHtml?: boolean;
      excludeTags?: string[];
      blockedWords?: string[];
      includeOnly?: string[];
      mainContent?: boolean;
    } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/crawl", {
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

  async search(
    query: string,
    opts: {
      limit?: number;
      scrapeResults?: boolean;
      lang?: string;
      country?: string;
      timeout?: number;
    } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/search", {
      query,
      limit: opts.limit ?? 5,
      scrape_results: opts.scrapeResults ?? true,
      lang: opts.lang ?? "en",
      country: opts.country ?? "us",
      timeout: opts.timeout ?? 60,
    });

    return this._pollJob("search", result.id);
  }

  async extract(
    url: string,
    prompt: string,
    opts: { timeout?: number } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/prompt-extract", {
      url,
      prompt,
      timeout: opts.timeout ?? 60,
    });

    return this._pollJob("extract", result.id);
  }

  async batchScrape(
    urls: string[],
    opts: { timeout?: number } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/batch-scrape", {
      url: urls,
      timeout: opts.timeout ?? 60,
    });

    return this._pollJob("batch-scrape", result.id);
  }

  async deepResearch(
    query: string,
    urls: string[],
    opts: { maxTokens?: number; timeout?: number } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/deep-research", {
      query,
      urls,
      max_tokens: opts.maxTokens ?? 4096,
      timeout: opts.timeout ?? 180,
    });

    return this._pollJob("deep-research", result.id);
  }

  async agent(
    url: string,
    prompt: string,
    opts: {
      maxSteps?: number;
      maxPages?: number;
      allowNavigation?: boolean;
      includeScreenshots?: boolean;
      timeout?: number;
    } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/agent", {
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

  async changeDetection(
    url: string,
    opts: {
      timeout?: number;
      mainContent?: boolean;
      excludeTags?: string[];
    } = {},
  ): Promise<unknown> {
    return this._request("POST", "/api/change-detection", {
      url: [url],
      timeout: opts.timeout ?? 60,
      main_content: opts.mainContent ?? true,
      exclude_tags: opts.excludeTags ?? ["header", "nav", "footer"],
    });
  }
}
