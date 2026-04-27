import { z } from "zod";
import { ScrapeTechnologyClient } from "./client.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: Record<string, unknown>, client: ScrapeTechnologyClient) => Promise<ToolResult>;
}

export const tools: ToolDefinition[] = [
  {
    name: "scrape",
    description:
      "Scrape a single URL and return its content as clean markdown. Ideal for reading articles, documentation, or any public web page.",
    schema: {
      url: z.string().url().describe("The URL to scrape"),
      mainContent: z
        .boolean()
        .optional()
        .describe("Extract only the main content, stripping sidebars and ads (default: true)"),
      includeLinks: z
        .boolean()
        .optional()
        .describe("Include hyperlinks in the output (default: false)"),
      includeHtml: z
        .boolean()
        .optional()
        .describe("Also return raw HTML alongside markdown (default: false)"),
      excludeTags: z
        .array(z.string())
        .optional()
        .describe("HTML tags to strip, e.g. [\"header\", \"nav\", \"footer\"]"),
      formats: z
        .array(z.enum(["markdown", "summary"]))
        .optional()
        .describe("Output formats to return"),
      timeout: z.number().optional().describe("Request timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.scrape(args.url as string, {
          mainContent: args.mainContent as boolean | undefined,
          includeLinks: args.includeLinks as boolean | undefined,
          includeHtml: args.includeHtml as boolean | undefined,
          excludeTags: args.excludeTags as string[] | undefined,
          formats: args.formats as ("markdown" | "summary")[] | undefined,
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "map",
    description:
      "Discover all URLs on a website by crawling its sitemap and link graph. Returns a list of URLs found on the site.",
    schema: {
      url: z.string().url().describe("The root URL of the website to map"),
      allowedWords: z
        .array(z.string())
        .optional()
        .describe("Only include URLs containing these words"),
      blockedWords: z
        .array(z.string())
        .optional()
        .describe("Exclude URLs containing these words"),
      maxUrls: z
        .number()
        .optional()
        .describe("Maximum number of URLs to return (default: 1000)"),
    },
    async handler(args, client) {
      try {
        const result = await client.map(args.url as string, {
          allowedWords: args.allowedWords as string[] | undefined,
          blockedWords: args.blockedWords as string[] | undefined,
          maxUrls: args.maxUrls as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "crawl",
    description:
      "Recursively crawl a website starting from a URL, following internal links up to a specified depth. Returns markdown content for each page visited.",
    schema: {
      url: z.string().url().describe("The starting URL to crawl"),
      maxDepth: z
        .number()
        .optional()
        .describe("Maximum link depth to follow from the start URL (default: 2)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of pages to crawl (default: 10)"),
      mainContent: z
        .boolean()
        .optional()
        .describe("Extract only main content from each page (default: true)"),
      includeLinks: z.boolean().optional().describe("Include hyperlinks in output (default: false)"),
      includeHtml: z.boolean().optional().describe("Include raw HTML alongside markdown (default: false)"),
      excludeTags: z.array(z.string()).optional().describe("HTML tags to strip"),
      blockedWords: z
        .array(z.string())
        .optional()
        .describe("Skip URLs containing these words"),
      includeOnly: z
        .array(z.string())
        .optional()
        .describe("Only crawl URLs containing these words"),
      timeout: z.number().optional().describe("Per-page timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.crawl(args.url as string, {
          maxDepth: args.maxDepth as number | undefined,
          limit: args.limit as number | undefined,
          mainContent: args.mainContent as boolean | undefined,
          includeLinks: args.includeLinks as boolean | undefined,
          includeHtml: args.includeHtml as boolean | undefined,
          excludeTags: args.excludeTags as string[] | undefined,
          blockedWords: args.blockedWords as string[] | undefined,
          includeOnly: args.includeOnly as string[] | undefined,
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "search",
    description:
      "Run a Google search and optionally scrape the content of the top results. Returns search result URLs and, when enabled, their full markdown content.",
    schema: {
      query: z.string().describe("The search query"),
      limit: z
        .number()
        .optional()
        .describe("Number of search results to return (default: 5)"),
      scrapeResults: z
        .boolean()
        .optional()
        .describe("Scrape and return full content for each result (default: true)"),
      lang: z.string().optional().describe("Result language code, e.g. \"en\" (default: \"en\")"),
      country: z
        .string()
        .optional()
        .describe("Result country code, e.g. \"us\" (default: \"us\")"),
      timeout: z.number().optional().describe("Timeout per page in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.search(args.query as string, {
          limit: args.limit as number | undefined,
          scrapeResults: args.scrapeResults as boolean | undefined,
          lang: args.lang as string | undefined,
          country: args.country as string | undefined,
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "extract",
    description:
      "Extract structured data from a URL using a natural language prompt. Describe what you want to extract and the API returns it as structured JSON.",
    schema: {
      url: z.string().url().describe("The URL to extract data from"),
      prompt: z
        .string()
        .describe(
          "Natural language description of what to extract, e.g. \"Extract all product names and prices\"",
        ),
      timeout: z.number().optional().describe("Timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.extract(
          args.url as string,
          args.prompt as string,
          { timeout: args.timeout as number | undefined },
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "batch_scrape",
    description:
      "Scrape multiple URLs in parallel. Returns markdown content for all provided URLs. More efficient than calling scrape repeatedly.",
    schema: {
      urls: z
        .array(z.string().url())
        .min(1)
        .describe("List of URLs to scrape"),
      timeout: z.number().optional().describe("Per-page timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.batchScrape(args.urls as string[], {
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "screenshot",
    description:
      "Take a full-page screenshot of a URL. Returns metadata about the screenshot. Note: binary image data cannot be returned as text; the response will contain a reference or base64 note from the API.",
    schema: {
      url: z.string().url().describe("The URL to screenshot"),
      timeout: z.number().optional().describe("Timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.screenshot(args.url as string, {
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "deep_research",
    description:
      "Scrape multiple URLs and synthesize their content using an LLM to answer a research question. Ideal for comparative analysis or summarizing information across several sources.",
    schema: {
      query: z.string().describe("The research question or topic to investigate"),
      urls: z
        .array(z.string().url())
        .min(1)
        .describe("List of URLs to scrape and research"),
      maxTokens: z
        .number()
        .optional()
        .describe("Maximum tokens for the LLM synthesis response (default: 4096)"),
      timeout: z.number().optional().describe("Timeout in seconds (default: 180)"),
    },
    async handler(args, client) {
      try {
        const result = await client.deepResearch(
          args.query as string,
          args.urls as string[],
          {
            maxTokens: args.maxTokens as number | undefined,
            timeout: args.timeout as number | undefined,
          },
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "agent",
    description:
      "Launch an AI agent that autonomously navigates a website to answer a question or complete a task. The agent can click, scroll, and follow links across multiple pages.",
    schema: {
      url: z.string().url().describe("The starting URL for the agent"),
      prompt: z
        .string()
        .describe(
          "The question to answer or task to complete, e.g. \"Find the pricing page and extract all plan names and prices\"",
        ),
      maxSteps: z
        .number()
        .optional()
        .describe("Maximum number of navigation steps the agent may take (default: 10)"),
      maxPages: z
        .number()
        .optional()
        .describe("Maximum number of pages the agent may visit (default: 5)"),
      allowNavigation: z
        .boolean()
        .optional()
        .describe("Allow the agent to follow links to other pages (default: true)"),
      includeScreenshots: z
        .boolean()
        .optional()
        .describe("Capture screenshots at each step (default: false)"),
      timeout: z.number().optional().describe("Total timeout in seconds (default: 120)"),
    },
    async handler(args, client) {
      try {
        const result = await client.agent(
          args.url as string,
          args.prompt as string,
          {
            maxSteps: args.maxSteps as number | undefined,
            maxPages: args.maxPages as number | undefined,
            allowNavigation: args.allowNavigation as boolean | undefined,
            includeScreenshots: args.includeScreenshots as boolean | undefined,
            timeout: args.timeout as number | undefined,
          },
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "instagram",
    description:
      "Extract public Instagram data: profiles (followers, bio, recent posts), individual posts (caption, likes, media URLs, hashtags, mentions), hashtag feeds (post URLs), or user search. Provide a session cookie to unlock authenticated content.",
    schema: {
      resource: z
        .enum(["profile", "post", "hashtag", "search"])
        .describe('"profile" | "post" | "hashtag" | "search"'),
      target: z
        .string()
        .describe(
          "Username for profile, post URL or shortcode for post, hashtag without # for hashtag, or search query",
        ),
      limit: z.number().optional().describe("Max items for hashtag/search (default: 20)"),
      sessionCookie: z
        .string()
        .optional()
        .describe('Instagram session cookie, e.g. "sessionid=abc123". Recommended for authenticated content.'),
    },
    async handler(args, client) {
      try {
        const result = await client.instagram(
          args.resource as string,
          args.target as string,
          {
            limit: args.limit as number | undefined,
            sessionCookie: args.sessionCookie as string | undefined,
          },
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "x",
    description:
      "Extract public X (Twitter) data: profiles (followers, bio, recent tweets), individual posts (text, likes, retweets, views, media URLs), or keyword/hashtag/mention search. A session cookie with auth_token and ct0 is recommended for complete data.",
    schema: {
      resource: z
        .enum(["profile", "post", "search"])
        .describe('"profile" | "post" | "search"'),
      target: z
        .string()
        .describe(
          "Username for profile, post URL for post, or search query (keywords, @mentions, #hashtags)",
        ),
      limit: z.number().optional().describe("Max posts for search (default: 20)"),
      sessionCookie: z
        .string()
        .optional()
        .describe('X session cookies: "auth_token=abc; ct0=xyz". Recommended for full content access.'),
    },
    async handler(args, client) {
      try {
        const result = await client.x(
          args.resource as string,
          args.target as string,
          {
            limit: args.limit as number | undefined,
            sessionCookie: args.sessionCookie as string | undefined,
          },
        );
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },

  {
    name: "change_detection",
    description:
      "Detect whether the content of a URL has changed since it was last checked. Useful for monitoring pages for updates.",
    schema: {
      url: z.string().url().describe("The URL to check for content changes"),
      mainContent: z
        .boolean()
        .optional()
        .describe("Compare only main content, ignoring sidebars and ads (default: true)"),
      excludeTags: z
        .array(z.string())
        .optional()
        .describe("HTML tags to ignore when comparing content"),
      timeout: z.number().optional().describe("Timeout in seconds (default: 60)"),
    },
    async handler(args, client) {
      try {
        const result = await client.changeDetection(args.url as string, {
          mainContent: args.mainContent as boolean | undefined,
          excludeTags: args.excludeTags as string[] | undefined,
          timeout: args.timeout as number | undefined,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  },
];
