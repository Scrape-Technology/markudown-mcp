import { test } from "node:test";
import assert from "node:assert/strict";
import { ScrapeTechnologyClient } from "../src/client.ts";
import { callTool, tools } from "../src/tools.ts";

test("tool arguments are validated before the API is called", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true; // answer "completed" so a regression fails fast instead of polling
    return new Response(JSON.stringify({ success: true, id: "j1", status: "completed" }));
  }) as typeof fetch;
  const agent = tools.find((t) => t.name === "agent")!;
  const client = new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://localhost" });
  const res = await callTool(agent, { url: "https://example.com", prompt: "q", maxPages: 50 }, client);
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /maxPages/);
  assert.equal(called, false);
});

// Records the POST body; null means fetch was never called.
async function sentBody(name: string, args: unknown) {
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url: string, init: { method: string; body?: string }) => {
    if (init.method === "POST") body = JSON.parse(init.body!);
    return new Response(JSON.stringify({ success: true, id: "j1", status: "completed" }));
  }) as typeof fetch;
  const client = new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://localhost" });
  const res = await callTool(tools.find((t) => t.name === name)!, args, client);
  return { res, body: body as Record<string, unknown> | null };
}

test("null optional arguments fall back to defaults", async () => {
  const { res, body } = await sentBody("scrape", { url: "https://example.com", timeout: null, excludeTags: null });
  assert.equal(res.isError, undefined);
  assert.equal(body!.timeout, 60);
  assert.deepEqual(body!.exclude_tags, ["header", "nav", "footer"]);
});

test("numeric strings are accepted for number fields, other strings are not", async () => {
  const { res, body } = await sentBody("crawl", { url: "https://example.com", limit: "5" });
  assert.equal(res.isError, undefined);
  assert.equal(body!.limit, 5);
  for (const limit of ["", " ", "abc", true, false, [], "Infinity"]) {
    const bad = await sentBody("crawl", { url: "https://example.com", limit });
    assert.equal(bad.res.isError, true, `limit ${JSON.stringify(limit)} should be rejected`);
    assert.equal(bad.body, null);
  }
  // still checked against min/max after conversion
  assert.equal((await sentBody("agent", { url: "https://example.com", prompt: "q", maxPages: "50" })).res.isError, true);
});
