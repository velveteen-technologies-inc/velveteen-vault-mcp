export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1>velveteen-vault-mcp</h1>
      <p>MCP server for a GitHub-backed Obsidian vault.</p>
      <p>
        Endpoint: <code>/api/mcp</code> (POST, Bearer auth)
      </p>
      <p>
        <a href="https://github.com/velveteen-technologies-inc/velveteen-vault-mcp">README</a>
      </p>
    </main>
  );
}
