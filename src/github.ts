import { Octokit } from "@octokit/rest";
import type { VaultConfig } from "./config";

export interface VaultFile {
  path: string;
  content: string;
  sha?: string;
  mtime?: string;
}

export interface PendingWrite {
  path: string;
  content: string;
  message: string;
}

/**
 * Lightweight GitHub client wrapping Octokit for vault reads and batched writes.
 * Reads use the contents API (single file) or git trees (listing).
 * Writes are batched into one commit per flush() call so a multi-tool conversation
 * produces a clean audit trail.
 */
export class GitHubVault {
  private octokit: Octokit;
  private pending: PendingWrite[] = [];

  constructor(private config: VaultConfig) {
    this.octokit = new Octokit({ auth: config.githubToken });
  }

  async readFile(path: string): Promise<VaultFile | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: this.config.branch,
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { path, content, sha: data.sha };
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  /** Lists every file in the vault via the git tree API (one request, no pagination for trees up to 100k entries). */
  async listAllFiles(): Promise<{ path: string; sha: string }[]> {
    const branchRef = await this.octokit.repos.getBranch({
      owner: this.config.owner,
      repo: this.config.repo,
      branch: this.config.branch,
    });
    const treeSha = branchRef.data.commit.commit.tree.sha;
    const tree = await this.octokit.git.getTree({
      owner: this.config.owner,
      repo: this.config.repo,
      tree_sha: treeSha,
      recursive: "true",
    });
    return tree.data.tree
      .filter((e) => e.type === "blob" && e.path)
      .map((e) => ({ path: e.path!, sha: e.sha! }));
  }

  /** Returns last-commit dates for the given paths. One API call per path; use sparingly. */
  async getMtimes(paths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    await Promise.all(
      paths.map(async (path) => {
        try {
          const { data } = await this.octokit.repos.listCommits({
            owner: this.config.owner,
            repo: this.config.repo,
            sha: this.config.branch,
            path,
            per_page: 1,
          });
          if (data[0]?.commit?.committer?.date) {
            result.set(path, data[0].commit.committer.date);
          }
        } catch {
          // skip — file may have been added in a way that fails listCommits
        }
      }),
    );
    return result;
  }

  queueWrite(write: PendingWrite): void {
    this.pending.push(write);
  }

  hasPending(): boolean {
    return this.pending.length > 0;
  }

  /**
   * Flushes pending writes as a single commit using the git data API.
   * Returns the new commit SHA. Idempotent on no-op (returns null).
   */
  async flush(): Promise<string | null> {
    if (this.pending.length === 0) return null;
    const { owner, repo, branch } = this.config;

    const ref = await this.octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const baseSha = ref.data.object.sha;
    const baseCommit = await this.octokit.git.getCommit({ owner, repo, commit_sha: baseSha });

    const blobs = await Promise.all(
      this.pending.map(async (w) => {
        const blob = await this.octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(w.content, "utf-8").toString("base64"),
          encoding: "base64",
        });
        return { path: w.path, sha: blob.data.sha };
      }),
    );

    const tree = await this.octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.data.tree.sha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: b.sha,
      })),
    });

    const message = this.buildCommitMessage();
    const commit = await this.octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.data.sha,
      parents: [baseSha],
      author: this.config.commitAuthor ?? undefined,
    });

    await this.octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.data.sha,
    });

    this.pending = [];
    return commit.data.sha;
  }

  private buildCommitMessage(): string {
    if (this.pending.length === 1) return this.pending[0]!.message;
    const lines = this.pending.map((w) => `- ${w.message}`);
    return `vault: ${this.pending.length} updates\n\n${lines.join("\n")}`;
  }
}
