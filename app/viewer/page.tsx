import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyViewerSession, viewerCookieName } from "../../src/viewer-session";
import { listVaultFiles, groupByTier } from "../../src/viewer-data";

export const dynamic = "force-dynamic";

function labelTier(tier: string): string {
  return tier
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default async function ViewerHome() {
  const jar = await cookies();
  const token = jar.get(viewerCookieName())?.value;
  if (!token || !(await verifyViewerSession(token))) {
    redirect("/viewer/login?next=/viewer");
  }

  const files = await listVaultFiles();
  const grouped = groupByTier(files);

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Vault</h1>
        <p style={{ color: "#666", margin: "0.25rem 0 0" }}>{files.length} notes</p>
      </header>

      {Object.entries(grouped).map(([tier, entries]) =>
        entries.length === 0 ? null : (
          <section key={tier} style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {labelTier(tier)} ({entries.length})
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {entries.map((f) => (
                <li key={f.path} style={{ padding: "0.4rem 0", borderBottom: "1px solid #eee" }}>
                  <Link
                    href={`/viewer/note?path=${encodeURIComponent(f.path)}`}
                    style={{ color: "#0a58ca", textDecoration: "none" }}
                  >
                    {f.path}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  padding: "2rem 1rem",
  maxWidth: "720px",
  margin: "0 auto",
  lineHeight: 1.5,
};
