const DEFAULT_BASE_URL = "https://api.scrapetechnology.com";
const DEFAULT_TIMEOUT = 120_000;
const POLL_INTERVAL = 2_000;
// Upper bound for waiting on one async job; without it a job stuck in "pending"/"processing"
// (stalled worker, lost job) hung the tool call forever.
const DEFAULT_POLL_TIMEOUT = 600_000;

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  /** Max milliseconds to wait for an async job (default: 600 000). */
  pollTimeout?: number;
  /** Milliseconds between status polls (default: 2 000). */
  pollInterval?: number;
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
  private pollTimeout: number;
  private pollInterval: number;

  constructor(opts: ClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const base = new URL(this.baseUrl);
    const local = base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
    if (base.protocol !== "https:" && !local) {
      throw new ScrapeTechnologyClientError(
        `Refusing API base URL ${base.protocol}//${base.host}: X-API-KEY would be sent in clear text. ` +
          "Use https:// (http:// is allowed only for localhost and 127.0.0.1); check MARKUDOWN_API_URL.",
      );
    }
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.pollTimeout = opts.pollTimeout ?? DEFAULT_POLL_TIMEOUT;
    this.pollInterval = opts.pollInterval ?? POLL_INTERVAL;
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
      // Every path we call matches its API route exactly, so a redirect is never expected; refuse it
      // rather than resend X-API-KEY to wherever the Location header points.
      redirect: "manual",
      signal: AbortSignal.timeout(this.timeout),
    });

    if (resp.status >= 300 && resp.status < 400) {
      let target = "an unknown location";
      try {
        const loc = new URL(resp.headers.get("location") ?? "", url);
        target = `${loc.protocol}//${loc.host}`; // no path or query: they may carry tokens
      } catch {}
      throw new ScrapeTechnologyClientError(
        `API redirected (${resp.status}) to ${target}; not followed so X-API-KEY is not sent there. ` +
          "Check MARKUDOWN_API_URL.",
        resp.status,
      );
    }

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
    const deadline = Date.now() + this.pollTimeout;
    while (Date.now() < deadline) {
      const status = await this._request<JobStatus>("GET", `/api/${queue}/${jobId}`);

      if (status.status === "completed") return status;
      if (status.status === "failed") {
        throw new ScrapeTechnologyClientError(status.error ?? "Job failed");
      }
      if (status.status === "not_found") {
        throw new ScrapeTechnologyClientError(`Job ${jobId} not found`, 404);
      }

      await new Promise((r) => setTimeout(r, this.pollInterval));
    }
    throw new ScrapeTechnologyClientError(
      `Job ${jobId} (${queue}) still not finished after ${this.pollTimeout / 1000}s; stopped waiting`,
    );
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
    const result = await this._request<JobResponse>("POST", "/api/map", {
      url: [url],
      allowed_words: opts.allowedWords ?? [],
      blocked_words: opts.blockedWords ?? [],
      max_urls: opts.maxUrls ?? 1000,
    });
    return this._pollJob("map", result.id);
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
      timeout?: number;
    } = {},
  ): Promise<unknown> {
    const result = await this._request<JobResponse>("POST", "/api/agent", {
      url,
      prompt,
      max_steps: opts.maxSteps ?? 10,
      max_pages: opts.maxPages ?? 5,
      allow_navigation: opts.allowNavigation ?? true,
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
    const result = await this._request<JobResponse>("POST", "/api/change-detection", {
      url,
      timeout: opts.timeout ?? 60,
      main_content: opts.mainContent ?? true,
      exclude_tags: opts.excludeTags ?? ["header", "nav", "footer"],
    });
    return this._pollJob("change-detection", result.id);
  }
}
