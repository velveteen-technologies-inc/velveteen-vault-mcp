import { describe, it, expect } from "vitest";
import {
  signAuthCode,
  verifyAuthCode,
  signAccessToken,
  verifyAccessToken,
  verifyPkce,
} from "../src/oauth";
import { createHash } from "node:crypto";

const cfg = {
  jwtSecret: "test-secret-must-be-long-enough-for-hs256-32+chars",
  consentPassword: "hunter2",
  baseUrl: "https://test.example.com",
};

describe("auth code roundtrip", () => {
  it("signs and verifies", async () => {
    const code = await signAuthCode(
      {
        redirect_uri: "https://claude.ai/cb",
        code_challenge: "abc",
        code_challenge_method: "S256",
        client_id: "c1",
      },
      cfg,
    );
    const payload = await verifyAuthCode(code, cfg);
    expect(payload.typ).toBe("auth_code");
    expect(payload.redirect_uri).toBe("https://claude.ai/cb");
    expect(payload.client_id).toBe("c1");
  });

  it("rejects access token as auth code", async () => {
    const at = await signAccessToken({ client_id: "c1", scope: "x" }, cfg);
    await expect(verifyAuthCode(at, cfg)).rejects.toThrow();
  });

  it("rejects with wrong secret", async () => {
    const code = await signAuthCode(
      {
        redirect_uri: "r",
        code_challenge: "c",
        code_challenge_method: "S256",
        client_id: "c1",
      },
      cfg,
    );
    await expect(verifyAuthCode(code, { ...cfg, jwtSecret: "different" })).rejects.toThrow();
  });
});

describe("access token", () => {
  it("roundtrips and exposes scope", async () => {
    const at = await signAccessToken({ client_id: "c1", scope: "vault:read vault:write" }, cfg);
    const p = await verifyAccessToken(at, cfg);
    expect(p.scope).toBe("vault:read vault:write");
    expect(p.client_id).toBe("c1");
  });
});

describe("PKCE", () => {
  it("S256 succeeds for matching verifier", () => {
    const verifier = "abc123-verifier-min-43-chars-long-aaaaaaaaa";
    const challenge = createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    expect(verifyPkce(verifier, challenge, "S256")).toBe(true);
  });

  it("S256 fails for wrong verifier", () => {
    const verifier = "abc123-verifier-min-43-chars-long-aaaaaaaaa";
    const challenge = createHash("sha256").update("other").digest("base64url");
    expect(verifyPkce(verifier, challenge, "S256")).toBe(false);
  });

  it("plain works", () => {
    expect(verifyPkce("same", "same", "plain")).toBe(true);
    expect(verifyPkce("a", "b", "plain")).toBe(false);
  });
});
