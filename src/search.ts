import type { GitHubVault } from "./github";
import { loadTierConfig } from "./config";

export interface SearchHit {
  path: string;
  score: number;
  snippet: string;
  tier: string;
}

/**
 * Tier name as a string. Values come from VAULT_TIERS env var (or defaults
 * insights/wiki/projects/people/daily-notes/raw). The literal "other" is
 * reserved for files that don't match any configured tier.
 */
export type Tier = string;

export function tierOf(path: string): Tier {
  const { tiers } = loadTierConfig();
  for (const tier of tiers) {
    if (path.startsWith(`${tier}/`)) return tier;
  }
  return "other";
}

function tierPriority(tier: string): number {
  const { tiers } = loadTierConfig();
  const idx = tiers.indexOf(tier);
  if (idx === -1) return -1; // "other" lowest
  return tiers.length - idx;
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
    const tierDiff = tierPriority(b.tier) - tierPriority(a.tier);
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
