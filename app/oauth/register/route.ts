import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Single-user system: we don't actually track clients. Anyone can register;
 * we hand back a static client_id. The real auth gate is the password on the
 * /oauth/authorize consent screen.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const redirectUris: string[] = Array.isArray(body.redirect_uris)
    ? body.redirect_uris
    : [];

  return NextResponse.json(
    {
      client_id: "velveteen-vault-mcp-public-client",
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "vault:read vault:write",
    },
    { status: 201 },
  );
}
