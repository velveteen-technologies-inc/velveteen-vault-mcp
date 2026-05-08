import { SignJWT, jwtVerify } from "jose";
import { loadOAuthConfig } from "./oauth";

const COOKIE = "vault_viewer_session";
const TTL = "30d";

export function viewerCookieName() {
  return COOKIE;
}

/**
 * Lightweight session cookie for the read-only web viewer. Re-uses the OAuth
 * password as the gate but issues a separate browser session JWT (different
 * from the MCP access token, smaller scope, shorter lifetime). All HMAC'd with
 * the same OAUTH_JWT_SECRET so we don't add another secret to manage.
 */
export async function signViewerSession(): Promise<string> {
  const cfg = loadOAuthConfig();
  return await new SignJWT({ typ: "viewer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .setIssuer(cfg.baseUrl)
    .sign(new TextEncoder().encode(cfg.jwtSecret));
}

export async function verifyViewerSession(token: string): Promise<boolean> {
  try {
    const cfg = loadOAuthConfig();
    const { payload } = await jwtVerify(token, new TextEncoder().encode(cfg.jwtSecret), {
      issuer: cfg.baseUrl,
    });
    return payload.typ === "viewer";
  } catch {
    return false;
  }
}
