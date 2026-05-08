import Link from "next/link";

export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "640px", margin: "0 auto", lineHeight: 1.6 }}>
      <h1>velveteen-vault-mcp</h1>
      <p>MCP server for a markdown second brain, plus a read-only web viewer.</p>
      <ul>
        <li>
          <Link href="/viewer">Browse the vault</Link>
        </li>
        <li>
          MCP endpoint: <code>/api/mcp</code> (Bearer or OAuth)
        </li>
        <li>
          <a href="https://github.com/velveteen-technologies-inc/velveteen-vault-mcp">README on GitHub</a>
        </li>
      </ul>
    </main>
  );
}
