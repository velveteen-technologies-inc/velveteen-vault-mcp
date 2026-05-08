import { redirect } from "next/navigation";
import { signAuthCode, loadOAuthConfig } from "../../../src/oauth";

export const dynamic = "force-dynamic";

interface SearchParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

/**
 * Consent screen. Shows a password gate (single-user) and an Approve button.
 * On approve, signs an auth code (JWT carrying the PKCE challenge) and
 * 302-redirects to claude.ai's redirect_uri with ?code=...&state=....
 */
export default async function AuthorizePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;

  if (
    !sp.client_id ||
    !sp.redirect_uri ||
    sp.response_type !== "code" ||
    !sp.code_challenge ||
    (sp.code_challenge_method && sp.code_challenge_method !== "S256")
  ) {
    return (
      <main style={containerStyle}>
        <h1>Invalid authorization request</h1>
        <p>Required parameters: client_id, redirect_uri, response_type=code, code_challenge.</p>
      </main>
    );
  }

  async function approve(formData: FormData) {
    "use server";
    const cfg = loadOAuthConfig();
    const password = String(formData.get("password") ?? "");
    if (password !== cfg.consentPassword) {
      // Re-render with error by re-redirecting to the same page with ?error=1
      const url = new URL(`${cfg.baseUrl}/oauth/authorize`);
      Object.entries(sp).forEach(([k, v]) => v && url.searchParams.set(k, v));
      url.searchParams.set("error", "bad_password");
      redirect(url.toString());
    }

    const code = await signAuthCode(
      {
        redirect_uri: sp.redirect_uri!,
        code_challenge: sp.code_challenge!,
        code_challenge_method: (sp.code_challenge_method as "S256") || "S256",
        client_id: sp.client_id!,
        scope: sp.scope,
      },
      cfg,
    );

    const url = new URL(sp.redirect_uri!);
    url.searchParams.set("code", code);
    if (sp.state) url.searchParams.set("state", sp.state);
    redirect(url.toString());
  }

  const showError = sp && (sp as any).error === "bad_password";

  return (
    <main style={containerStyle}>
      <h1>Authorize Claude</h1>
      <p style={{ color: "#666", lineHeight: 1.5 }}>
        Claude wants to access your vault MCP server with these scopes:
      </p>
      <ul>
        <li><code>vault:read</code> — search and read notes</li>
        <li><code>vault:write</code> — create insights, append session logs, add wikilinks</li>
      </ul>
      <form action={approve} style={{ marginTop: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Password
          <input
            type="password"
            name="password"
            required
            autoFocus
            style={{
              display: "block",
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              marginTop: "0.25rem",
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
          />
        </label>
        {showError && (
          <p style={{ color: "#c00", fontSize: "0.9rem", margin: "0.5rem 0" }}>
            Incorrect password.
          </p>
        )}
        <button
          type="submit"
          style={{
            marginTop: "1rem",
            padding: "0.6rem 1.2rem",
            fontSize: "1rem",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Approve
        </button>
      </form>
    </main>
  );
}

const containerStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  padding: "2rem",
  maxWidth: "480px",
  margin: "3rem auto",
  border: "1px solid #eee",
  borderRadius: 8,
};
