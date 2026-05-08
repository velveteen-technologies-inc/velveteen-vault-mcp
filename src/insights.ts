import { ulid } from "ulid";
import type { GitHubVault } from "./github.js";
import { getInsightFrontmatter, parse, stringify, isInsight } from "./frontmatter.js";

export interface InsightSummary {
  path: string;
  title: string;
  status: string;
  confidence: number;
  tags: string[];
  created: string;
  last_updated: string;
  supersedes: string[];
  oneLine: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildInsightFile(input: {
  title: string;
  content: string;
  tags: string[];
  evidence: string[];
  confidence: number;
  status: "draft" | "active" | "revised" | "retired";
  supersedes: string[];
}): { path: string; body: string } {
  const id = ulid();
  const now = new Date().toISOString();
  const slug = slugify(input.title) || id.toLowerCase();
  const path = `insights/${slug}.md`;
  const body = stringify(
    {
      id,
      title: input.title,
      created: now,
      last_updated: now,
      status: input.status,
      confidence: input.confidence,
      tags: input.tags,
      evidence: input.evidence,
      supersedes: input.supersedes,
    },
    input.content.endsWith("\n") ? input.content : input.content + "\n",
  );
  return { path, body };
}

export async function loadAllInsights(vault: GitHubVault): Promise<InsightSummary[]> {
  const files = await vault.listAllFiles();
  const insightFiles = files.filter(
    (f) => f.path.startsWith("insights/") && f.path.endsWith(".md") && f.path !== "insights/README.md",
  );
  const summaries: InsightSummary[] = [];
  const concurrency = 20;
  for (let i = 0; i < insightFiles.length; i += concurrency) {
    const batch = insightFiles.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (f) => {
        const file = await vault.readFile(f.path);
        if (!file) return null;
        const { data, body } = parse(file.content);
        const fm = getInsightFrontmatter(data);
        if (!fm) return null;
        return {
          path: f.path,
          title: fm.title,
          status: fm.status,
          confidence: fm.confidence,
          tags: fm.tags,
          created: fm.created,
          last_updated: fm.last_updated,
          supersedes: fm.supersedes,
          oneLine: firstLine(body),
        };
      }),
    );
    for (const r of results) if (r) summaries.push(r);
  }
  return summaries;
}

function firstLine(body: string): string {
  const trimmed = body.trim();
  const nl = trimmed.indexOf("\n");
  return (nl >= 0 ? trimmed.slice(0, nl) : trimmed).slice(0, 200);
}

/**
 * Marks an existing insight as `revised` and updates its frontmatter to point at successors.
 * Returns the updated content for queueing as a write. Caller is responsible for queuing.
 */
export function markSuperseded(
  rawContent: string,
  supersededByPath: string,
): string {
  const { data, body } = parse(rawContent);
  if (!isInsight(data)) return rawContent;
  data.status = "revised";
  data.last_updated = new Date().toISOString();
  return stringify(data, body);
}
