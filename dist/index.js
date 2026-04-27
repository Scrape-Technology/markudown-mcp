#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ScrapeTechnologyClient } from "./client.js";
import { tools } from "./tools.js";
const apiKey = process.env.MARKUDOWN_API_KEY;
if (!apiKey) {
    process.stderr.write("Error: MARKUDOWN_API_KEY environment variable is required.\n" +
        "Get your API key at https://scrapetechnology.com\n");
    process.exit(1);
}
const baseUrl = process.env.MARKUDOWN_API_URL ?? "https://api.scrapetechnology.com";
const client = new ScrapeTechnologyClient({ apiKey, baseUrl });
const server = new Server({ name: "markudown-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
            type: "object",
            properties: Object.fromEntries(Object.entries(t.schema).map(([key, zodType]) => {
                const shape = zodType;
                return [key, zodTypeToJsonSchema(shape)];
            })),
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
    return tool.handler((args ?? {}), client);
});
function zodTypeToJsonSchema(schema) {
    if (schema instanceof z.ZodOptional) {
        return zodTypeToJsonSchema(schema.unwrap());
    }
    if (schema instanceof z.ZodString) {
        const base = { type: "string" };
        if (schema.description)
            base.description = schema.description;
        return base;
    }
    if (schema instanceof z.ZodNumber) {
        const base = { type: "number" };
        if (schema.description)
            base.description = schema.description;
        return base;
    }
    if (schema instanceof z.ZodBoolean) {
        const base = { type: "boolean" };
        if (schema.description)
            base.description = schema.description;
        return base;
    }
    if (schema instanceof z.ZodArray) {
        const base = {
            type: "array",
            items: zodTypeToJsonSchema(schema.element),
        };
        if (schema.description)
            base.description = schema.description;
        return base;
    }
    if (schema instanceof z.ZodEnum) {
        const base = { enum: schema.options };
        if (schema.description)
            base.description = schema.description;
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
//# sourceMappingURL=index.js.map