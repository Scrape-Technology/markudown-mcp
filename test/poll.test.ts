// Run: npm test  (tsx strips the types; Node >= 22.18 can also run it directly)
import { test } from "node:test";
import assert from "node:assert/strict";
import { ScrapeTechnologyClient } from "../src/client.ts";

function stubFetch(status: unknown, httpStatus = 200) {
  globalThis.fetch = (async (_url: string, init: { method: string }) => {
    const body = init.method === "POST" ? { success: true, id: "j1", url: "/api/crawl/j1" } : status;
    return new Response(JSON.stringify(body), { status: init.method === "POST" ? 200 : httpStatus });
  }) as typeof fetch;
}

const client = (pollTimeout = 5_000) =>
  new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://localhost", pollTimeout, pollInterval: 1 });

test("gives up at pollTimeout instead of polling forever", async () => {
  stubFetch({ success: false, id: "j1", status: "processing" });
  await assert.rejects(client(30).crawl("https://example.com"), /still not finished/);
});

test("not_found stops with 404", async () => {
  stubFetch({ success: false, id: "j1", status: "not_found" });
  await assert.rejects(client().crawl("https://example.com"), { statusCode: 404 });
});

test("HTTP 404 stops with 404", async () => {
  stubFetch({ detail: "Job not found" }, 404);
  await assert.rejects(client().crawl("https://example.com"), { statusCode: 404 });
});

test("agent request no longer sends include_screenshots", async () => {
  let sent: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: { method: string; body?: string }) => {
    if (init.method === "POST") {
      sent = JSON.parse(init.body!);
      return new Response(JSON.stringify({ success: true, id: "j1", url: "/api/agent/j1" }));
    }
    return new Response(JSON.stringify({ success: true, id: "j1", status: "completed", data: {} }));
  }) as typeof fetch;
  await client().agent("https://example.com", "q");
  assert.equal("include_screenshots" in sent, false);
});
