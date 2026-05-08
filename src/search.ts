import type { GitHubVault } from "./github";

export interface SearchHit {
  path: string;
  score: number;
  snippet: string;
  tier: Tier;
}

export type Tier = "insights" | "wiki" | "projects" | "people" | "daily-notes" | "raw" | "other";

const TIER_PRIORITY: Record<Tier, number> = {
  insights: 6,
  wiki: 5,
  projects: 4,
  people: 3,
  "daily-notes": 2,
  raw: 1,
  other: 0,
};

export function tierOf(path: string): Tier {
  if (path.startsWith("insights/")) return "insights";
  if (path.startsWith("wiki/")) return "wiki";
  if (path.startsWith("projects/")) return "projects";
  if (path.startsWith("people/")) return "people";
  if (path.startsWith("daily-notes/")) return "daily-notes";
  if (path.startsWith("raw/")) return "raw";
  return "other";
}

/**
 * Keyword search across the vault.
 * Strategy: list all .md files, fetch in parallel (capped), score by term frequency
 * weighted by tier priority. Cheap and good enough for a single-user vault < 10k notes.
 *
 * For very large vaults, swap this for an index built at deploy time.
 */
export async function searchVault(
  vault: GitHubVault,
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const all = await vault.listAllFiles();
  const markdown = all.filter((f) => f.path.endsWith(".md"));

  const hits: SearchHit[] = [];
  const concurrency = 20;
  for (let i = 0; i < markdown.length; i += concurrency) {
    const batch = markdown.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (f) => {
        const file = await vault.readFile(f.path);
        if (!file) return null;
        const score = scoreContent(file.content, terms, f.path);
        if (score <= 0) return null;
        const snippet = makeSnippet(file.content, terms);
        return { path: f.path, score, snippet, tier: tierOf(f.path) };
      }),
    );
    for (const r of results) if (r) hits.push(r);
  }

  hits.sort((a, b) => {
    const tierDiff = TIER_PRIORITY[b.tier] - TIER_PRIORITY[a.tier];
    if (tierDiff !== 0) return tierDiff;
    return b.score - a.score;
  });
  return hits.slice(0, limit);
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export function scoreContent(content: string, terms: string[], path: string): number {
  const text = (content + " " + path).toLowerCase();
  let score = 0;
  for (const term of terms) {
    const matches = text.split(term).length - 1;
    score += matches;
    // Bonus if term appears in the path
    if (path.toLowerCase().includes(term)) score += 5;
    // Bonus if term appears in first 200 chars (likely title/frontmatter)
    if (text.slice(0, 200).includes(term)) score += 3;
  }
  return score;
}

export function makeSnippet(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  let bestIdx = 0;
  let bestTerm = terms[0]!;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      bestIdx = idx;
      bestTerm = term;
      break;
    }
  }
  const start = Math.max(0, bestIdx - 80);
  const end = Math.min(content.length, bestIdx + bestTerm.length + 120);
  let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}
