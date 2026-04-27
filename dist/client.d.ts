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
export declare class ScrapeTechnologyClientError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number);
}
export declare class ScrapeTechnologyClient {
    private apiKey;
    private baseUrl;
    private timeout;
    constructor(opts: ClientOptions);
    private _request;
    private _pollJob;
    scrape(url: string, opts?: {
        timeout?: number;
        excludeTags?: string[];
        mainContent?: boolean;
        includeLinks?: boolean;
        includeHtml?: boolean;
        formats?: ("markdown" | "summary")[];
    }): Promise<unknown>;
    map(url: string, opts?: {
        allowedWords?: string[];
        blockedWords?: string[];
        maxUrls?: number;
    }): Promise<unknown>;
    screenshot(url: string, opts?: {
        timeout?: number;
    }): Promise<unknown>;
    crawl(url: string, opts?: {
        maxDepth?: number;
        limit?: number;
        timeout?: number;
        includeLinks?: boolean;
        includeHtml?: boolean;
        excludeTags?: string[];
        blockedWords?: string[];
        includeOnly?: string[];
        mainContent?: boolean;
    }): Promise<unknown>;
    search(query: string, opts?: {
        limit?: number;
        scrapeResults?: boolean;
        lang?: string;
        country?: string;
        timeout?: number;
    }): Promise<unknown>;
    extract(url: string, prompt: string, opts?: {
        timeout?: number;
    }): Promise<unknown>;
    batchScrape(urls: string[], opts?: {
        timeout?: number;
    }): Promise<unknown>;
    deepResearch(query: string, urls: string[], opts?: {
        maxTokens?: number;
        timeout?: number;
    }): Promise<unknown>;
    agent(url: string, prompt: string, opts?: {
        maxSteps?: number;
        maxPages?: number;
        allowNavigation?: boolean;
        includeScreenshots?: boolean;
        timeout?: number;
    }): Promise<unknown>;
    changeDetection(url: string, opts?: {
        timeout?: number;
        mainContent?: boolean;
        excludeTags?: string[];
    }): Promise<unknown>;
}
//# sourceMappingURL=client.d.ts.map