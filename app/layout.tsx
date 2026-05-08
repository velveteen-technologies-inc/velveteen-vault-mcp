export const metadata = {
  title: "velveteen-vault-mcp",
  description: "MCP server for a GitHub-backed Obsidian vault",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
