# velveteen-vault-mcp

A remote MCP server that connects Claude (Desktop, mobile, or any MCP client) to a GitHub-backed markdown second brain. Designed for "talk to your second brain" use — Claude searches, reads, and writes notes during conversations, with every write becoming a git commit.

Includes a read-only web viewer at `/viewer` so you can browse the vault on any device without an editor app.

Built for [Velveteen Technologies](https://velveteen.tech), released MIT for anyone who wants the same setup. The vault is plain markdown — Obsidian compatible if you want to use it, but Obsidian (or any specific editor) is not required.

## What it does

10 tools across read and write:

**Read**
- `vault_search(query, limit)` — keyword search, ranked by tier (insights → wiki → projects → people → daily-notes → raw)
- `vault_read(path)` — fetch a specific note
- `vault_recent(days, limit)` — recently touched notes across all tiers
- `vault_recent_insights(days, limit)` — recently created/updated insights with one-line summaries
- `vault_active_threads()` — insights with `status: active`, grouped by primary tag
- `vault_stale_insights(min_age_days)` — once-active insights not touched in a while; surfaces revisitable threads
- `vault_cross_reference(topic_or_path)` — finds notes sharing one tag but not all, surfacing cross-domain bridges

**Write**
- `vault_write_insight(title, content, tags, evidence, confidence, status, supersedes)` — creates an insight; if `supersedes` is set, the prior insights are auto-marked `revised`
- `vault_append_session(date, summary, topics_discussed, insights_created)` — appends to `raw/sessions/YYYY-MM-DD.md`
- `vault_link(from_path, to_path, context)` — adds a `[[wikilink]]` from one note to another under a "Related" section

All writes go through the GitHub API as commits — `git log` is your audit trail. Multi-tool calls within a single tool invocation are batched into one commit.

## Vault structure

The server expects a markdown vault organized into tiers. Adapt to your own conventions; the tier prefixes are what's hardcoded:

```
vault/
├── raw/         staging — clipped articles, transcripts, brain dumps
├── wiki/        curated synthesized knowledge
├── insights/    working-memory: atomic claims with status/confidence/supersedes (this is what the MCP writes)
├── daily-notes/ freeform daily notes
├── projects/    project-specific long-form notes
└── people/      contact notes
```

### Insight frontmatter

Every insight written by `vault_write_insight` has this YAML header:

```yaml
---
id: <ulid>
title: <human readable>
created: <ISO date>
last_updated: <ISO date>
status: draft | active | revised | retired
confidence: 0.0-1.0
tags: [<from your controlled vocab>]
evidence: [<paths to raw/ or wiki/ files>]
supersedes: [<paths to prior insight versions>]
---
```

Status flow: `draft` (Claude wrote it, you haven't engaged) → `active` (you've used it) → `revised` (newer insight supersedes) → `retired`.

## Setup

### 1. Prepare your vault repo

Create a private GitHub repo containing your Obsidian vault. Add an empty `insights/` directory if you don't have one. The repo's default branch should match `VAULT_BRANCH`.

### 2. Generate a GitHub token

Fine-grained PAT scoped to that single repo, with **Contents: Read and write** permission.

### 3. Deploy this server

```bash
git clone https://github.com/velveteen-technologies-inc/velveteen-vault-mcp
cd velveteen-vault-mcp
npm install
vercel deploy --prod
```

Set environment variables in Vercel:

| Var | Value |
|-----|-------|
| `GITHUB_TOKEN` | The PAT from step 2 |
| `VAULT_OWNER` | Your GitHub username or org |
| `VAULT_REPO` | Your vault repo name |
| `VAULT_BRANCH` | `main` (or your default branch) |
| `MCP_BEARER_TOKEN` | A long random string. Generate with `openssl rand -hex 32` |
| `COMMIT_AUTHOR_NAME` | (optional) Author name for vault commits |
| `COMMIT_AUTHOR_EMAIL` | (optional) Author email for vault commits |

### 4. Connect from Claude

In Claude (mobile or desktop), add a remote MCP connector pointing at:

```
https://<your-deployment>.vercel.app/api/mcp
```

Header: `Authorization: Bearer <MCP_BEARER_TOKEN>`

### 5. (Optional) Use locally over stdio

For Claude Desktop or local testing without Vercel:

```json
{
  "mcpServers": {
    "vault": {
      "command": "node",
      "args": ["/absolute/path/to/velveteen-vault-mcp/dist/src/stdio.js"],
      "env": {
        "GITHUB_TOKEN": "...",
        "VAULT_OWNER": "...",
        "VAULT_REPO": "...",
        "MCP_BEARER_TOKEN": "unused-but-required"
      }
    }
  }
}
```

Run `npm run build` first.

## Bootstrap prompt

When you first connect Claude to the vault, paste the contents of [`docs/bootstrap-prompt.md`](docs/bootstrap-prompt.md) as a system message or initial turn. It teaches Claude how to use the tools — when to write insights, how to use status/confidence, when to supersede vs. create new.

## Development

```bash
npm install
npm test         # vitest, no GitHub needed
npm run lint     # tsc --noEmit
```

Tests mock no GitHub — they cover pure logic (search scoring, frontmatter parsing, slug generation, supersession). Integration testing happens against a real test vault.

## Architecture choices and trade-offs

- **GitHub API as source of truth.** No local filesystem state. Every read fetches fresh; every write commits. Trade-off: GitHub API latency per call (~100–300ms). For a single-user vault this is fine.
- **Search is keyword-only in v1.** Lists all `.md`, fetches in parallel, scores by term frequency + tier weight + path/header bonuses. No vector store. For vaults with thousands of notes this still completes in a few seconds; if it doesn't scale for you, swap `src/search.ts` for a precomputed index.
- **Single-user auth.** One bearer token. Designed for personal use. Multi-user OAuth is intentionally out of scope.
- **Vercel Node runtime, not Edge.** Octokit + gray-matter both work fine on Edge but the MCP SDK's transport is more battle-tested on Node.
- **Batched commits per tool call.** Multi-step writes within one tool invocation make one commit. Across separate tool calls, each call commits separately.

## Not in v1

- Semantic search / embeddings
- Auto-generated weekly digest
- Ingestion pipelines (YouTube, web clips) — those are separate workers, not MCP tools
- Multi-user auth
- A web UI

## License

MIT
