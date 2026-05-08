import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadOAuthConfig } from "../../../src/oauth";
import { signViewerSession, viewerCookieName } from "../../../src/viewer-session";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await props.searchParams;

  async function login(formData: FormData) {
    "use server";
    const cfg = loadOAuthConfig();
    const password = String(formData.get("password") ?? "");
    if (password !== cfg.consentPassword) {
      redirect(`/viewer/login?error=1${sp.next ? `&next=${encodeURIComponent(sp.next)}` : ""}`);
    }
    const token = await signViewerSession();
    const jar = await cookies();
    jar.set(viewerCookieName(), token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/viewer",
    });
    redirect(sp.next || "/viewer");
  }

  return (
    <main style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>Vault</h1>
      <p style={{ color: "#666", lineHeight: 1.5, marginBottom: "1.5rem" }}>
        Read-only browse. Same password as the OAuth consent page.
      </p>
      <form action={login}>
        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="Password"
          style={inputStyle}
        />
        {sp.error && (
          <p style={{ color: "#c00", fontSize: "0.9rem", margin: "0.5rem 0" }}>
            Incorrect password.
          </p>
        )}
        <button type="submit" style={buttonStyle}>
          Sign in
        </button>
      </form>
    </main>
  );
}

const containerStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  padding: "2rem",
  maxWidth: "400px",
  margin: "4rem auto",
};
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.6rem",
  fontSize: "1rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  boxSizing: "border-box",
};
const buttonStyle: React.CSSProperties = {
  marginTop: "1rem",
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  background: "#000",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};
