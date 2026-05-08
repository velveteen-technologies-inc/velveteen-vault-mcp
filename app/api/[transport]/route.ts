import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "../../../src/server";
import { loadAuthConfig } from "../../../src/config";
import { loadOAuthConfig, verifyAccessToken } from "../../../src/oauth";

export const maxDuration = 60;

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

    // Path 1: static bearer (Claude Desktop / CLI / curl convenience).
    try {
      const expected = loadAuthConfig().bearerToken;
      if (bearerToken === expected) {
        return {
          token: bearerToken,
          clientId: "static-bearer",
          scopes: ["vault:read", "vault:write"],
        };
      }
    } catch {
      // MCP_BEARER_TOKEN unset; that's fine, fall through to OAuth.
    }

    // Path 2: OAuth-issued JWT access token (claude.ai mobile/web).
    try {
      const cfg = loadOAuthConfig();
      const payload = await verifyAccessToken(bearerToken, cfg);
      return {
        token: bearerToken,
        clientId: payload.client_id,
        scopes: payload.scope.split(" "),
      };
    } catch {
      return undefined;
    }
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
