import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "../src/server.js";
import { loadConfig } from "../src/config.js";

/**
 * Vercel route: POST /api/mcp (and GET for SSE).
 * Auth: Bearer token in `Authorization` header, must match MCP_BEARER_TOKEN env var.
 */
const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  { basePath: "/api" },
);

const authedHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    const expected = loadConfig().bearerToken;
    if (bearerToken !== expected) return undefined;
    return {
      token: bearerToken,
      clientId: "single-user",
      scopes: ["vault:read", "vault:write"],
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
