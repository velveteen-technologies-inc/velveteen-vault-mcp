import { NextResponse } from "next/server";
import { loadOAuthConfig } from "../../../src/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = loadOAuthConfig();
  return NextResponse.json({
    resource: `${cfg.baseUrl}/api/mcp`,
    authorization_servers: [cfg.baseUrl],
    scopes_supported: ["vault:read", "vault:write"],
    bearer_methods_supported: ["header"],
  });
}
