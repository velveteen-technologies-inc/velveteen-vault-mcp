import { NextRequest, NextResponse } from "next/server";
import {
  loadOAuthConfig,
  signAccessToken,
  verifyAuthCode,
  verifyPkce,
} from "../../../src/oauth";

export const dynamic = "force-dynamic";

/**
 * Exchanges an authorization code for an access token. Verifies PKCE
 * (RFC 7636) using the code_verifier sent here against the code_challenge
 * embedded in the auth-code JWT.
 */
export async function POST(req: NextRequest) {
  const cfg = loadOAuthConfig();
  const form = await req.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const code = String(form.get("code") ?? "");
  const codeVerifier = String(form.get("code_verifier") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");

  if (grantType !== "authorization_code") {
    return errorResponse("unsupported_grant_type", "only authorization_code is supported");
  }
  if (!code || !codeVerifier) {
    return errorResponse("invalid_request", "code and code_verifier required");
  }

  let payload;
  try {
    payload = await verifyAuthCode(code, cfg);
  } catch {
    return errorResponse("invalid_grant", "auth code invalid or expired");
  }

  if (redirectUri && redirectUri !== payload.redirect_uri) {
    return errorResponse("invalid_grant", "redirect_uri mismatch");
  }

  if (!verifyPkce(codeVerifier, payload.code_challenge, payload.code_challenge_method)) {
    return errorResponse("invalid_grant", "PKCE verification failed");
  }

  const accessToken = await signAccessToken(
    { client_id: payload.client_id, scope: payload.scope ?? "vault:read vault:write" },
    cfg,
  );

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 365 * 24 * 60 * 60,
    scope: payload.scope ?? "vault:read vault:write",
  });
}

function errorResponse(error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}
