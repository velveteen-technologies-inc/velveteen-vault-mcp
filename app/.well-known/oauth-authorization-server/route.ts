import { NextResponse } from "next/server";
import { loadOAuthConfig } from "../../../src/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = loadOAuthConfig();
  return NextResponse.json({
    issuer: cfg.baseUrl,
    authorization_endpoint: `${cfg.baseUrl}/oauth/authorize`,
    token_endpoint: `${cfg.baseUrl}/oauth/token`,
    registration_endpoint: `${cfg.baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["vault:read", "vault:write"],
  });
}
