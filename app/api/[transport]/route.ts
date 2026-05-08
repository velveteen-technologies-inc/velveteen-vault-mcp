import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "../../../src/server";
import { loadAuthConfig } from "../../../src/config";

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
    const expected = loadAuthConfig().bearerToken;
    if (bearerToken !== expected) return undefined;
    return {
      token: bearerToken,
      clientId: "single-user",
      scopes: ["vault:read", "vault:write"],
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
