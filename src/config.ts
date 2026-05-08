export interface VaultConfig {
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
  bearerToken: string;
  commitAuthor: { name: string; email: string } | null;
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

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}
