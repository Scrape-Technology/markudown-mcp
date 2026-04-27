import { z } from "zod";
import { ScrapeTechnologyClient } from "./client.js";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: boolean;
};
export interface ToolDefinition {
    name: string;
    description: string;
    schema: z.ZodRawShape;
    handler: (args: Record<string, unknown>, client: ScrapeTechnologyClient) => Promise<ToolResult>;
}
export declare const tools: ToolDefinition[];
export {};
//# sourceMappingURL=tools.d.ts.map