import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ScrapeTechnologyClient } from "../src/client.ts";

function listen(handler: Parameters<typeof createServer>[1]): Promise<Server> {
  const server = createServer(handler);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
const port = (s: Server) => (s.address() as AddressInfo).port;

test("a redirect is reported, not followed, and the target never sees the key", async () => {
  let targetHits = 0;
  const target = await listen((_req, res) => {
    targetHits++;
    res.end("{}");
  });
  const api = await listen((_req, res) => {
    res.writeHead(307, { Location: `http://127.0.0.1:${port(target)}/steal?token=secret` }).end();
  });
  try {
    const client = new ScrapeTechnologyClient({ apiKey: "k", baseUrl: `http://127.0.0.1:${port(api)}` });
    await assert.rejects(client.scrape("https://example.com"), (e: Error & { statusCode?: number }) => {
      assert.equal(e.name, "ScrapeTechnologyClientError");
      assert.equal(e.statusCode, 307);
      assert.match(e.message, new RegExp(`127\\.0\\.0\\.1:${port(target)}`));
      assert.match(e.message, /MARKUDOWN_API_URL/);
      assert.doesNotMatch(e.message, /secret/);
      return true;
    });
    assert.equal(targetHits, 0);
  } finally {
    api.close();
    target.close();
  }
});

test("an http:// base URL is refused unless it is localhost", () => {
  assert.throws(() => new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://api.example.com" }), /https/);
  new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "https://api.example.com" });
  new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://localhost:8000" });
  new ScrapeTechnologyClient({ apiKey: "k", baseUrl: "http://127.0.0.1:8000" });
});
