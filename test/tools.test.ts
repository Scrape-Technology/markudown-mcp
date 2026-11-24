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
  const client = new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://test" });
  const res = await callTool(agent, { url: "https://example.com", prompt: "q", maxPages: 50 }, client);
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /maxPages/);
  assert.equal(called, false);
});
