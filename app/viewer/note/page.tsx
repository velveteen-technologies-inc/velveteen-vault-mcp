import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { verifyViewerSession, viewerCookieName } from "../../../src/viewer-session";
import { fetchMarkdown } from "../../../src/viewer-data";
import { parse } from "../../../src/frontmatter";

export const dynamic = "force-dynamic";

export default async function NotePage(props: {
  searchParams: Promise<{ path?: string }>;
}) {
  const sp = await props.searchParams;
  const jar = await cookies();
  const token = jar.get(viewerCookieName())?.value;
  if (!token || !(await verifyViewerSession(token))) {
    const nextParam = sp.path
      ? `?next=${encodeURIComponent(`/viewer/note?path=${encodeURIComponent(sp.path)}`)}`
      : "";
    redirect(`/viewer/login${nextParam}`);
  }

  if (!sp.path) {
    redirect("/viewer");
  }

  const raw = await fetchMarkdown(sp.path);
  if (!raw) {
    return (
      <main style={mainStyle}>
        <Link href="/viewer" style={backLink}>← Back</Link>
        <h1>Not found</h1>
        <p>{sp.path}</p>
      </main>
    );
  }

  const { data, body } = parse(raw);
  const html = DOMPurify.sanitize(await marked.parse(body));

  return (
    <main style={mainStyle}>
      <Link href="/viewer" style={backLink}>← Back</Link>
      <h1 style={{ marginTop: "1rem", marginBottom: "0.25rem" }}>
        {String(data.title ?? sp.path)}
      </h1>
      <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1.5rem" }}>{sp.path}</p>
      {hasFrontmatter(data) && (
        <pre style={fmStyle}>
          {Object.entries(data)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${k}: ${formatVal(v)}`)
            .join("\n")}
        </pre>
      )}
      <article
        style={{ marginTop: "1.5rem", lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}

function hasFrontmatter(data: Record<string, unknown>): boolean {
  return Object.keys(data).length > 0;
}

function formatVal(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

const mainStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  padding: "2rem 1rem 4rem",
  maxWidth: "720px",
  margin: "0 auto",
  lineHeight: 1.5,
};

const backLink: React.CSSProperties = {
  color: "#0a58ca",
  textDecoration: "none",
  fontSize: "0.9rem",
};

const fmStyle: React.CSSProperties = {
  background: "#f6f8fa",
  padding: "0.75rem 1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  margin: 0,
};
