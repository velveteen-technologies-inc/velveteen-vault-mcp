import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubVault } from "./github.js";
import { loadConfig } from "./config.js";
import { searchVault, tierOf } from "./search.js";
import { parse, stringify, getInsightFrontmatter } from "./frontmatter.js";
import { buildInsightFile, loadAllInsights, markSuperseded } from "./insights.js";

/**
 * Builds a standalone MCP server (for stdio transport / local testing).
 */
export function buildServer() {
  const server = new McpServer({
    name: "velveteen-vault-mcp",
    version: "0.1.0",
  });
  registerTools(server);
  return server;
}

type ToolCapableServer = {
  registerTool: McpServer["registerTool"];
};

/**
 * Registers all 10 vault tools onto any McpServer-shaped object.
 * Used by both the standalone server (stdio) and the Vercel HTTP handler.
 *
 * Each tool constructs a fresh GitHubVault so pending writes don't leak between
 * concurrent calls. Vercel functions are short-lived; this also avoids stale Octokit clients.
 */
export function registerTools(server: ToolCapableServer): void {
  const newVault = () => new GitHubVault(loadConfig());

  // ------------------------------------------------------------------
  // READ TOOLS
  // ------------------------------------------------------------------

  server.registerTool(
    "vault_search",
    {
      title: "Search vault",
      description:
        "Keyword search across the vault. Returns paths, snippets, scores. Insights tier ranks first, then wiki, projects, people, daily-notes, raw.",
      inputSchema: {
        query: z.string().min(1).describe("Search terms"),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, limit }) => {
      const hits = await searchVault(newVault(), query, limit);
      return { content: [{ type: "text", text: JSON.stringify(hits, null, 2) }] };
    },
  );

  server.registerTool(
    "vault_read",
    {
      title: "Read vault note",
      description: "Fetch full content of a specific note by path (e.g., 'wiki/claude-code/index.md').",
      inputSchema: {
        path: z.string().min(1),
      },
    },
    async ({ path }) => {
      const file = await newVault().readFile(path);
      if (!file) {
        return {
          content: [{ type: "text", text: `Not found: ${path}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: file.content }] };
    },
  );

  server.registerTool(
    "vault_recent",
    {
      title: "Recently touched notes",
      description: "List notes touched in the last N days, all tiers, sorted by mtime (newest first).",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(7),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ days, limit }) => {
      const vault = newVault();
      const all = await vault.listAllFiles();
      const md = all.filter((f) => f.path.endsWith(".md")).map((f) => f.path);
      const mtimes = await vault.getMtimes(md);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const recent = [...mtimes.entries()]
        .filter(([, dt]) => Date.parse(dt) >= cutoff)
        .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
        .slice(0, limit)
        .map(([path, mtime]) => ({ path, mtime, tier: tierOf(path) }));
      return { content: [{ type: "text", text: JSON.stringify(recent, null, 2) }] };
    },
  );

  server.registerTool(
    "vault_recent_insights",
    {
      title: "Recent insights",
      description: "Insights created or updated in the last N days, with one-line summaries.",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(14),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ days, limit }) => {
      const insights = await loadAllInsights(newVault());
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const recent = insights
        .filter((i) => Date.parse(i.last_updated) >= cutoff)
        .sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated))
        .slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(recent, null, 2) }] };
    },
  );

  server.registerTool(
    "vault_active_threads",
    {
      title: "Active insight threads",
      description: "All insights with status='active', grouped by primary tag, sorted by recency.",
      inputSchema: {},
    },
    async () => {
      const insights = await loadAllInsights(newVault());
      const active = insights.filter((i) => i.status === "active");
      const grouped: Record<string, typeof active> = {};
      for (const i of active) {
        const primaryTag = i.tags[0] ?? "untagged";
        (grouped[primaryTag] ??= []).push(i);
      }
      for (const tag of Object.keys(grouped)) {
        grouped[tag]!.sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated));
      }
      return { content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }] };
    },
  );

  server.registerTool(
    "vault_stale_insights",
    {
      title: "Stale insights",
      description: "Insights once active but not touched in min_age_days+. Surfaces revisitable threads.",
      inputSchema: {
        min_age_days: z.number().int().min(1).max(3650).default(30),
      },
    },
    async ({ min_age_days }) => {
      const insights = await loadAllInsights(newVault());
      const cutoff = Date.now() - min_age_days * 24 * 60 * 60 * 1000;
      const stale = insights
        .filter((i) => i.status === "active" && Date.parse(i.last_updated) < cutoff)
        .sort((a, b) => Date.parse(a.last_updated) - Date.parse(b.last_updated));
      return { content: [{ type: "text", text: JSON.stringify(stale, null, 2) }] };
    },
  );

  server.registerTool(
    "vault_cross_reference",
    {
      title: "Cross-reference",
      description:
        "Given a topic (string) or insight path, finds notes sharing one tag but not all — surfacing non-obvious cross-domain connections.",
      inputSchema: {
        topic_or_path: z.string().min(1),
      },
    },
    async ({ topic_or_path }) => {
      const vault = newVault();
      const insights = await loadAllInsights(vault);
      let anchorTags: string[] = [];

      if (topic_or_path.startsWith("insights/")) {
        const anchor = insights.find((i) => i.path === topic_or_path);
        if (!anchor) {
          return {
            content: [{ type: "text", text: `No insight found at ${topic_or_path}` }],
            isError: true,
          };
        }
        anchorTags = anchor.tags;
      } else {
        anchorTags = topic_or_path
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
      }

      if (anchorTags.length === 0) {
        return { content: [{ type: "text", text: "[]" }] };
      }

      // Score: shares >=1 tag but not ALL tags. Higher = more "bridge-like".
      const scored = insights
        .filter((i) => i.path !== topic_or_path)
        .map((i) => {
          const shared = i.tags.filter((t) => anchorTags.includes(t)).length;
          const distinct = i.tags.filter((t) => !anchorTags.includes(t)).length;
          const score = shared > 0 && distinct > 0 ? shared * distinct : 0;
          return { path: i.path, title: i.title, tags: i.tags, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return { content: [{ type: "text", text: JSON.stringify(scored, null, 2) }] };
    },
  );

  // ------------------------------------------------------------------
  // WRITE TOOLS
  // ------------------------------------------------------------------

  server.registerTool(
    "vault_write_insight",
    {
      title: "Write insight",
      description:
        "Create a new insight note in insights/. If supersedes is set, the prior insights are marked status=revised.",
      inputSchema: {
        title: z.string().min(1),
        content: z.string().min(1),
        tags: z.array(z.string()).default([]),
        evidence: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1).default(0.6),
        status: z.enum(["draft", "active", "revised", "retired"]).default("draft"),
        supersedes: z.array(z.string()).default([]),
      },
    },
    async (input) => {
      const vault = newVault();
      const built = buildInsightFile(input);
      vault.queueWrite({
        path: built.path,
        content: built.body,
        message: `vault: add insight ${built.path}`,
      });

      for (const oldPath of input.supersedes) {
        const old = await vault.readFile(oldPath);
        if (old) {
          const updated = markSuperseded(old.content, built.path);
          vault.queueWrite({
            path: oldPath,
            content: updated,
            message: `vault: mark ${oldPath} revised (superseded by ${built.path})`,
          });
        }
      }

      const sha = await vault.flush();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ path: built.path, commit: sha }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "vault_append_session",
    {
      title: "Append session log",
      description:
        "Appends to raw/sessions/YYYY-MM-DD.md. One file per day, accumulates across multiple conversations.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO date YYYY-MM-DD"),
        summary: z.string().min(1),
        topics_discussed: z.array(z.string()).default([]),
        insights_created: z.array(z.string()).default([]),
      },
    },
    async ({ date, summary, topics_discussed, insights_created }) => {
      const vault = newVault();
      const path = `raw/sessions/${date}.md`;
      const existing = await vault.readFile(path);
      const ts = new Date().toISOString();
      const block = [
        `## ${ts}`,
        ``,
        summary,
        ``,
        topics_discussed.length ? `**Topics:** ${topics_discussed.join(", ")}` : "",
        insights_created.length
          ? `**Insights created:**\n${insights_created.map((p) => `- [[${p}]]`).join("\n")}`
          : "",
        ``,
      ]
        .filter(Boolean)
        .join("\n");

      const newContent = existing
        ? existing.content.trimEnd() + "\n\n" + block
        : `# Session log — ${date}\n\n${block}`;

      vault.queueWrite({
        path,
        content: newContent,
        message: `vault: session log ${date}`,
      });
      const sha = await vault.flush();
      return {
        content: [{ type: "text", text: JSON.stringify({ path, commit: sha }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "vault_link",
    {
      title: "Add wikilink",
      description:
        "Adds a [[wikilink]] from one note to another, optionally with a sentence of context. Appended under a 'Related' section.",
      inputSchema: {
        from_path: z.string().min(1),
        to_path: z.string().min(1),
        context: z.string().optional(),
      },
    },
    async ({ from_path, to_path, context }) => {
      const vault = newVault();
      const file = await vault.readFile(from_path);
      if (!file) {
        return {
          content: [{ type: "text", text: `Not found: ${from_path}` }],
          isError: true,
        };
      }
      const target = wikilinkTarget(to_path);
      const linkLine = context ? `- [[${target}]] — ${context}` : `- [[${target}]]`;
      const updated = appendUnderHeading(file.content, "Related", linkLine);

      // Also bump frontmatter last_updated if it's an insight
      const { data, body } = parse(updated);
      let final = updated;
      if (typeof data.status === "string") {
        data.last_updated = new Date().toISOString();
        final = stringify(data, body);
      }

      vault.queueWrite({
        path: from_path,
        content: final,
        message: `vault: link ${from_path} -> ${to_path}`,
      });
      const sha = await vault.flush();
      return {
        content: [{ type: "text", text: JSON.stringify({ from: from_path, to: to_path, commit: sha }) }],
      };
    },
  );

}

export function wikilinkTarget(path: string): string {
  const stem = path.replace(/^.*\//, "").replace(/\.md$/, "");
  return stem;
}

export function appendUnderHeading(content: string, heading: string, line: string): string {
  const headingRe = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  if (headingRe.test(content)) {
    return content.replace(headingRe, (m) => `${m}\n${line}`);
  }
  const trimmed = content.trimEnd();
  return `${trimmed}\n\n## ${heading}\n\n${line}\n`;
}
