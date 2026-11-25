#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ScrapeTechnologyClient } from "./client.js";
import { callTool, tools } from "./tools.js";

const apiKey = process.env.MARKUDOWN_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "Error: MARKUDOWN_API_KEY environment variable is required.\n" +
      "Get your API key at https://scrapetechnology.com\n",
  );
  process.exit(1);
}

const baseUrl =
  process.env.MARKUDOWN_API_URL ?? "https://api.scrapetechnology.com";

let client: ScrapeTechnologyClient;
try {
  client = new ScrapeTechnologyClient({ apiKey, baseUrl });
} catch (e) {
  process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}

const server = new Server(
  { name: "markudown-mcp", version: "2.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(t.schema).map(([key, zodType]) => {
          const shape = zodType as z.ZodTypeAny;
          return [key, zodTypeToJsonSchema(shape)];
        }),
      ),
      required: Object.entries(t.schema)
        .filter(([, v]) => !(v instanceof z.ZodOptional))
        .map(([k]) => k),
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find((t) => t.name === name);

  if (!tool) {
    return {
      content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
      isError: true,
    };
  }

  return callTool(tool, args, client);
});

function zodTypeToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodOptional) {
    // .optional().describe() puts the description on the wrapper, not the inner type
    const inner = zodTypeToJsonSchema(schema.unwrap() as z.ZodTypeAny);
    if (schema.description) inner.description = schema.description;
    return inner;
  }
  if (schema instanceof z.ZodString) {
    const base: Record<string, unknown> = { type: "string" };
    if (schema.format === "url") base.format = "uri";
    if (schema.description) base.description = schema.description;
    return base;
  }
  if (schema instanceof z.ZodNumber) {
    const base: Record<string, unknown> = { type: schema.isInt ? "integer" : "number" };
    if (Number.isFinite(schema.minValue)) base.minimum = schema.minValue;
    if (Number.isFinite(schema.maxValue)) base.maximum = schema.maxValue;
    if (schema.description) base.description = schema.description;
    return base;
  }
  if (schema instanceof z.ZodBoolean) {
    const base: Record<string, unknown> = { type: "boolean" };
    if (schema.description) base.description = schema.description;
    return base;
  }
  if (schema instanceof z.ZodArray) {
    const base: Record<string, unknown> = {
      type: "array",
      items: zodTypeToJsonSchema(schema.element as z.ZodTypeAny),
    };
    if (schema.description) base.description = schema.description;
    return base;
  }
  if (schema instanceof z.ZodEnum) {
    const base: Record<string, unknown> = { enum: schema.options };
    if (schema.description) base.description = schema.description;
    return base;
  }
  return {};
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("markudown-mcp running on stdio\n");
}

process.on("SIGTERM", () => {
  server.close().then(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close().then(() => process.exit(0));
});

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
