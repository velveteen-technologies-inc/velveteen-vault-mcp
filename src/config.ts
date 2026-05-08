export interface VaultConfig {
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
  bearerToken: string;
  commitAuthor: { name: string; email: string } | null;
}

export interface TierConfig {
  /** Ordered tiers (highest priority first) used for search ranking and viewer grouping. */
  tiers: string[];
  /** Folder where MCP-written insights land. Must be one of `tiers`. */
  insightsTier: string;
  /** Folder where session logs append. Must be one of `tiers`. */
  sessionTier: string;
  /** Optional human label per tier (defaults to titlecased folder name). */
  labels: Record<string, string>;
}

const DEFAULT_TIERS = ["insights", "wiki", "projects", "people", "daily-notes", "raw"];

export function loadTierConfig(): TierConfig {
  const raw = process.env.VAULT_TIERS;
  const tiers = raw
    ? raw.split(",").map((t) => t.trim()).filter(Boolean)
    : DEFAULT_TIERS;
  const insightsTier = process.env.VAULT_INSIGHTS_TIER || (tiers.includes("insights") ? "insights" : tiers[0]!);
  const sessionTier = process.env.VAULT_SESSION_TIER || (tiers.includes("raw") ? "raw" : tiers[tiers.length - 1]!);
  const labels: Record<string, string> = {};
  return { tiers, insightsTier, sessionTier, labels };
}

export function loadConfig(): VaultConfig {
  const owner = required("VAULT_OWNER");
  const repo = required("VAULT_REPO");
  const branch = process.env.VAULT_BRANCH || "main";
  const githubToken = required("GITHUB_TOKEN");
  const bearerToken = required("MCP_BEARER_TOKEN");
  const name = process.env.COMMIT_AUTHOR_NAME;
  const email = process.env.COMMIT_AUTHOR_EMAIL;
  const commitAuthor = name && email ? { name, email } : null;
  return { owner, repo, branch, githubToken, bearerToken, commitAuthor };
}

/** Bearer-only config used by the auth layer; doesn't require GITHUB_TOKEN to be set. */
export function loadAuthConfig(): { bearerToken: string } {
  return { bearerToken: required("MCP_BEARER_TOKEN") };
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}
