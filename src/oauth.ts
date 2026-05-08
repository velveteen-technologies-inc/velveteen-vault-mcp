import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash } from "node:crypto";

/**
 * Minimal stateless OAuth 2.1 + Dynamic Client Registration (RFC 7591) for a
 * single-user MCP server. No database; everything is signed JWTs.
 *
 * Flow:
 *   claude.ai POSTs /oauth/register, gets back static client_id (we don't track clients)
 *   user opens /oauth/authorize?... in browser, enters password, clicks Approve
 *   server signs an auth-code JWT carrying the PKCE challenge, redirects back
 *   claude.ai POSTs /oauth/token with code + code_verifier; server verifies and
 *   issues an access-token JWT (long-lived, no refresh).
 *
 * The MCP /api/mcp endpoint accepts the access-token JWT via Bearer auth.
 */

export interface OAuthConfig {
  /** HMAC secret for signing all JWTs. Treat as a high-entropy secret. */
  jwtSecret: string;
  /** Password the user types on the consent screen. */
  consentPassword: string;
  /** Public URL of the deployment, e.g. https://velveteen-vault-mcp.vercel.app */
  baseUrl: string;
}

export function loadOAuthConfig(): OAuthConfig {
  const jwtSecret = process.env.OAUTH_JWT_SECRET;
  const consentPassword = process.env.OAUTH_PASSWORD;
  const baseUrl = process.env.OAUTH_BASE_URL;
  if (!jwtSecret) throw new Error("Missing OAUTH_JWT_SECRET");
  if (!consentPassword) throw new Error("Missing OAUTH_PASSWORD");
  if (!baseUrl) throw new Error("Missing OAUTH_BASE_URL");
  return { jwtSecret, consentPassword, baseUrl };
}

const ACCESS_TOKEN_TTL = "365d"; // long-lived, no refresh path
const AUTH_CODE_TTL_S = 600; // 10 min — claude.ai exchanges within seconds

function secretKey(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export interface AuthCodePayload extends JWTPayload {
  typ: "auth_code";
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256" | "plain";
  client_id: string;
  scope?: string;
}

export interface AccessTokenPayload extends JWTPayload {
  typ: "access_token";
  client_id: string;
  scope: string;
}

export async function signAuthCode(
  payload: Omit<AuthCodePayload, "typ" | keyof JWTPayload>,
  cfg: OAuthConfig,
): Promise<string> {
  return await new SignJWT({ ...payload, typ: "auth_code" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CODE_TTL_S}s`)
    .setIssuer(cfg.baseUrl)
    .sign(secretKey(cfg.jwtSecret));
}

export async function verifyAuthCode(
  token: string,
  cfg: OAuthConfig,
): Promise<AuthCodePayload> {
  const { payload } = await jwtVerify(token, secretKey(cfg.jwtSecret), {
    issuer: cfg.baseUrl,
  });
  if (payload.typ !== "auth_code") throw new Error("not an auth code");
  return payload as AuthCodePayload;
}

export async function signAccessToken(
  payload: { client_id: string; scope: string },
  cfg: OAuthConfig,
): Promise<string> {
  return await new SignJWT({ ...payload, typ: "access_token" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setIssuer(cfg.baseUrl)
    .sign(secretKey(cfg.jwtSecret));
}

export async function verifyAccessToken(
  token: string,
  cfg: OAuthConfig,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(cfg.jwtSecret), {
    issuer: cfg.baseUrl,
  });
  if (payload.typ !== "access_token") throw new Error("not an access token");
  return payload as AccessTokenPayload;
}

/** Verifies a PKCE code_verifier against the stored code_challenge. */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: "S256" | "plain",
): boolean {
  if (method === "plain") return verifier === challenge;
  const hash = createHash("sha256").update(verifier).digest();
  const computed = base64url(hash);
  return timingSafeEqual(computed, challenge);
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
