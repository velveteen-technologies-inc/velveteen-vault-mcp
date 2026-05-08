import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Returns pong.",
        inputSchema: { msg: z.string().default("hello") },
      },
      async ({ msg }) => ({ content: [{ type: "text", text: `pong: ${msg}` }] }),
    );
  },
  {},
  { basePath: "/api" },
);

export { handler as GET, handler as POST };
