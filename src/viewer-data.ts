import { GitHubVault } from "./github";
import { loadConfig } from "./config";
import { tierOf, type Tier } from "./search";

export interface FileEntry {
  path: string;
  tier: Tier;
}

const TIER_ORDER: Tier[] = ["insights", "wiki", "projects", "people", "daily-notes", "raw", "other"];

export async function listVaultFiles(): Promise<FileEntry[]> {
  const vault = new GitHubVault(loadConfig());
  const all = await vault.listAllFiles();
  return all
    .filter((f) => f.path.endsWith(".md"))
    .map((f) => ({ path: f.path, tier: tierOf(f.path) }));
}

export function groupByTier(files: FileEntry[]): Record<Tier, FileEntry[]> {
  const grouped = {} as Record<Tier, FileEntry[]>;
  for (const t of TIER_ORDER) grouped[t] = [];
  for (const f of files) grouped[f.tier].push(f);
  for (const t of TIER_ORDER) grouped[t].sort((a, b) => a.path.localeCompare(b.path));
  return grouped;
}

export async function fetchMarkdown(path: string): Promise<string | null> {
  const vault = new GitHubVault(loadConfig());
  const file = await vault.readFile(path);
  return file?.content ?? null;
}
