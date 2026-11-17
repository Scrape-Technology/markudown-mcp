# markudown-mcp

[![npm version](https://img.shields.io/npm/v/markudown-mcp.svg)](https://www.npmjs.com/package/markudown-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)

MCP server for [MarkUDown / Scrape Technology](https://scrapetechnology.com) — gives AI agents (Claude, Cursor, Windsurf, n8n, LangGraph, etc.) access to web scraping, Google search, data extraction, and more.

**No infrastructure needed.** Just an API key — get one free at [scrapetechnology.com/markudown/register](https://scrapetechnology.com/markudown/register) (**500 free credits, no credit card**). Docs: [scrapetechnology.com/markudown/docs](https://scrapetechnology.com/markudown/docs).

```bash
MARKUDOWN_API_KEY=your-key npx -y markudown-mcp
```

---

## How it works

```
AI Agent (Claude Desktop, Cursor, etc.)
        │  MCP protocol (stdio)
        ▼
  markudown-mcp  (this package)
        │  HTTPS + polling
        ▼
  api.scrapetechnology.com
        │  BullMQ jobs
        ▼
  MarkUDown Engine workers
```

---

## Quick start

```bash
MARKUDOWN_API_KEY=your-key npx markudown-mcp
```

Get your API key at [scrapetechnology.com/markudown/register](https://scrapetechnology.com/markudown/register).

---

## Claude Desktop

Add to `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "markudown": {
      "command": "npx",
      "args": ["markudown-mcp"],
      "env": {
        "MARKUDOWN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Cursor / Windsurf

Add to your editor's MCP config:

```json
{
  "markudown": {
    "command": "npx",
    "args": ["markudown-mcp"],
    "env": {
      "MARKUDOWN_API_KEY": "your-api-key-here"
    }
  }
}
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MARKUDOWN_API_KEY` | Yes | — | Your Scrape Technology API key |
| `MARKUDOWN_API_URL` | No | `https://api.scrapetechnology.com` | Override the API base URL |

> **Note:** a key the API does not recognise is not rejected — it is served as the anonymous free tier (20 requests/day), and a 429 "Free tier daily limit exceeded" follows once that is used up. If you see that message with a paid key, check the key in your dashboard. Only a missing key returns 401.

Async tools (crawl, map, search, extract, batch_scrape, deep_research, agent, change_detection) wait at most 10 minutes for the job; after that the tool returns an error with the job id instead of waiting forever.

---

## Available tools

### `scrape`
Scrape a single URL and return its content as clean Markdown.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | URL to scrape |
| `mainContent` | boolean | `true` | Strip navigation, ads, and sidebars |
| `includeLinks` | boolean | `false` | Include hyperlinks in output |
| `includeHtml` | boolean | `false` | Also return raw HTML |
| `excludeTags` | string[] | `["header","nav","footer"]` | HTML tags to strip |
| `formats` | (`"markdown"` \| `"summary"`)[] | — | Output formats to return |
| `timeout` | number | `60` | Timeout in seconds |

**Example prompt:** *"Scrape https://example.com and summarize the main content."*

---

### `map`
Discover all URLs on a website via sitemap parsing and link crawling.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Root URL of the site |
| `maxUrls` | number | `1000` | Maximum URLs to return |
| `allowedWords` | string[] | `[]` | Only include URLs containing these words |
| `blockedWords` | string[] | `[]` | Exclude URLs containing these words |

**Example prompt:** *"Map all URLs on docs.example.com."*

---

### `crawl`
Recursively crawl a website, following internal links. Returns Markdown for each page.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Starting URL |
| `maxDepth` | number | `2` | Maximum link depth |
| `limit` | number | `10` | Maximum pages to crawl |
| `mainContent` | boolean | `true` | Extract only main content |
| `includeLinks` | boolean | `false` | Add each page's links to its result |
| `includeHtml` | boolean | `false` | Include raw HTML |
| `excludeTags` | string[] | — | HTML tags to strip |
| `blockedWords` | string[] | — | Skip URLs with these words |
| `includeOnly` | string[] | — | Only follow URLs containing one of these strings (`*` matches anything); the start URL is always crawled |
| `timeout` | number | `60` | Per-page timeout in seconds |

**Example prompt:** *"Crawl https://docs.example.com up to depth 3 and find all mentions of 'authentication'."*

---

### `search`
Run a Google search and optionally scrape the full content of each result page.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Search query |
| `limit` | number | `5` | Number of results |
| `scrapeResults` | boolean | `true` | Scrape full content for each result |
| `lang` | string | `"en"` | Language code |
| `country` | string | `"us"` | Country code |
| `timeout` | number | `60` | Per-page timeout in seconds |

**Example prompt:** *"Search for 'best web scraping libraries 2025' and summarize the top 5 results."*

---

### `extract`
Scrape a URL and extract structured data using a natural language prompt.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | URL to extract from |
| `prompt` | string | required | What to extract, e.g. `"All product names and prices"` |
| `timeout` | number | `60` | Timeout in seconds |

**Example prompt:** *"Extract all job listings from https://jobs.example.com including title, location, and salary."*

---

### `batch_scrape`
Scrape multiple URLs in parallel. Returns Markdown for each.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `urls` | string[] | required | URLs to scrape (at least 1) |
| `timeout` | number | `60` | Per-page timeout in seconds |

**Example prompt:** *"Scrape these 5 competitor pricing pages and compare their plans."*

---

### `screenshot`
Take a full-page screenshot of a URL.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | URL to screenshot |
| `timeout` | number | `60` | Navigation timeout in seconds |

**Example prompt:** *"Take a screenshot of https://example.com."*

---

### `deep_research`
Scrape multiple URLs and synthesize their content into a comprehensive research report using an LLM.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Research question or topic |
| `urls` | string[] | required | Source URLs to scrape (at least 1) |
| `maxTokens` | number | `4096` | Maximum tokens for the report |
| `timeout` | number | `180` | Timeout in seconds |

**Example prompt:** *"Research the pricing strategies of these 3 SaaS companies and write a comparative analysis."*

---

### `agent`
Launch an AI agent that navigates a website to answer a question. It reads each page (scrolling to load lazy content) and follows links; it does not click buttons or fill in forms.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Starting URL |
| `prompt` | string | required | Task or question for the agent |
| `maxSteps` | number | `10` | Maximum navigation steps |
| `maxPages` | number | `5` | Maximum pages to visit |
| `allowNavigation` | boolean | `true` | Allow following links |
| `timeout` | number | `120` | Total timeout in seconds |

**Example prompt:** *"Go to https://shop.example.com and find the return policy."*

---

### `change_detection`
Detect whether a URL's content has changed since it was last checked.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | URL to monitor |
| `mainContent` | boolean | `true` | Compare only main content |
| `excludeTags` | string[] | `["header","nav","footer"]` | Tags to ignore when comparing (currently ignored by the API) |
| `timeout` | number | `60` | Timeout in seconds |

**Example prompt:** *"Check if the pricing page at https://example.com/pricing has changed."*

---

## Support & Community

| Channel | Link |
|---------|------|
| 💬 Discord | [discord.gg/GBSKsC8DvS](https://discord.gg/GBSKsC8DvS) |
| 📧 Email | [joao.sobhie@scrapetechnology.com](mailto:joao.sobhie@scrapetechnology.com) |
| 🌐 Docs | [scrapetechnology.com/markudown/docs](https://scrapetechnology.com/markudown/docs) |

## License

MIT
