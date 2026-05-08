# vault-mcp

Self-hostable MCP server that turns a private GitHub markdown repo into a second brain you can talk to from Claude. Includes a read-only web viewer at `/viewer` so you can browse on any device. ~$0/month on Vercel free tier. Single-user, no database, MIT.

```
GitHub markdown repo  ↔  Vault MCP server (Vercel)  ↔  Claude (mobile, desktop, CLI)
                                  ↑
                      Browser at /viewer (any device)
```

## What you get

**11 MCP tools.** Read: search, fetch, recent, recent insights, active threads, stale insights, cross-reference. Write: create insight, update insight, append session log, add link.

**Insights, not just notes.** Every MCP-written note has YAML frontmatter — `status` (draft/active/revised/retired), `confidence` (0–1), `tags`, `evidence`, `supersedes`. Lets Claude track which beliefs are still load-bearing and which got revised.

**Git-backed audit trail.** Every write is a commit. `git log` is the change history.

**OAuth 2.1 + DCR + static bearer.** Works with claude.ai mobile/web (OAuth) and Claude Desktop / CLI / curl (bearer). Stateless JWTs, no Redis/KV needed.

**Read-only web viewer.** `/viewer` shows all notes grouped by tier, renders markdown, displays frontmatter. Password-gated, mobile-friendly.

## Deploy your own (5 minutes)

### 1. Fork your vault

Create a private GitHub repo for your vault. Add at least one folder — `notes/`, `insights/`, whatever you want. The MCP doesn't care about specific folder names; you configure them per-deployment.

### 2. Deploy the MCP server to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvelveteen-technologies-inc%2Fvelveteen-vault-mcp&env=GITHUB_TOKEN,VAULT_OWNER,VAULT_REPO,MCP_BEARER_TOKEN,OAUTH_JWT_SECRET,OAUTH_PASSWORD,OAUTH_BASE_URL&envDescription=Required%20config%20for%20your%20vault%20MCP&envLink=https%3A%2F%2Fgithub.com%2Fvelveteen-technologies-inc%2Fvelveteen-vault-mcp%23environment-variables)

Or manually: clone, `npm install`, `vercel deploy --prod`.

### 3. Set environment variables

| Var | Value | Notes |
|-----|-------|-------|
| `GITHUB_TOKEN` | Fine-grained PAT | Scoped to your vault repo only. Permissions: Contents: read+write |
| `VAULT_OWNER` | GitHub user/org | |
| `VAULT_REPO` | Repo name | |
| `VAULT_BRANCH` | `main` | Optional, defaults to `main` |
| `MCP_BEARER_TOKEN` | random hex | `openssl rand -hex 32`. For Desktop / CLI access |
| `OAUTH_JWT_SECRET` | random hex | `openssl rand -hex 48`. For OAuth + viewer JWTs |
| `OAUTH_PASSWORD` | your password | Gate for OAuth consent and viewer login |
| `OAUTH_BASE_URL` | deployment URL | e.g. `https://yourname-vault.vercel.app` |
| `VAULT_TIERS` | comma-list | Optional. Default: `insights,wiki,projects,people,daily-notes,raw` |
| `VAULT_INSIGHTS_TIER` | tier name | Optional. Where `vault_write_insight` lands. Default: `insights` |
| `VAULT_SESSION_TIER` | tier name | Optional. Where `vault_append_session` appends. Default: `raw` |
| `COMMIT_AUTHOR_NAME` | string | Optional. Author for vault commits |
| `COMMIT_AUTHOR_EMAIL` | string | Optional |

### 4. Connect from Claude

**claude.ai mobile/web** → Settings → Connectors → Add custom → URL: `https://your-deployment.vercel.app/api/mcp` → leave OAuth fields blank → on first use, the consent page asks for `OAUTH_PASSWORD`.

**Claude Desktop** → `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vault": {
      "url": "https://your-deployment.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_BEARER_TOKEN>" }
    }
  }
}
```

**Claude CLI** → similar, in `.claude/mcp.json` or via `claude mcp add`.

### 5. (Optional) Browse on phone

Open `https://your-deployment.vercel.app/viewer` in any browser. Sign in with `OAUTH_PASSWORD`. 30-day session cookie.

### 6. Tell Claude how to use it

Copy `docs/bootstrap-prompt.md`, fill in the placeholders for your tier descriptions and tag vocab, and use it as the system prompt or initial message for vault-aware conversations.

## Tier model

The MCP organizes notes into ordered tiers. Tier name = first path segment of a file. Default tiers (highest to lowest priority):

- `insights/` — atomic claims with lifecycle frontmatter. The MCP writes here.
- `wiki/` — curated synthesized knowledge. Authoritative.
- `projects/` — project-specific long-form.
- `people/` — contacts.
- `daily-notes/` — freeform dailies.
- `raw/` — clippings, transcripts, brain dumps. Lowest priority.

Override with `VAULT_TIERS=mytier1,mytier2,mytier3`. The order determines search ranking and viewer grouping.

## Insight frontmatter

Every insight written by `vault_write_insight`:

```yaml
---
id: <ulid>
title: <human readable>
created: <ISO timestamp>
last_updated: <ISO timestamp>
status: draft | active | revised | retired
confidence: 0.0-1.0
tags: [<from your vocab>]
evidence: [<paths to source notes>]
supersedes: [<paths to prior insight versions>]
---
```

Status flow: `draft` (Claude wrote it, you haven't engaged) → `active` (you've used it) → `revised` (newer insight supersedes) → `retired`.

## Architecture choices

- **GitHub API as source of truth.** No local filesystem state. Every read fetches fresh; every write commits. Trade-off: ~100–300ms per call. Fine for single-user.
- **Keyword search only in v1.** Lists all `.md`, fetches in parallel, scores by term frequency + tier weight + path/header bonuses. No vector store. Scales to a few thousand notes.
- **Single-user auth.** One bearer + one OAuth password. Multi-user is intentionally out of scope.
- **Vercel Node runtime, Next.js App Router.** `mcp-handler` ([@vercel/mcp-handler](https://github.com/vercel/mcp-handler)) for Streamable HTTP transport.
- **Stateless JWTs for OAuth.** No Redis/KV. Auth codes carry PKCE challenge in the JWT.
- **Batched commits.** Multiple writes in one tool invocation = one commit. Across tool calls = separate commits.

## Not in v1

- Semantic search / embeddings
- Auto-generated weekly digest
- Ingestion pipelines (YouTube, web clips) — those are separate workers, not MCP tools
- Multi-user auth
- Full editing UI in the web viewer (read-only by design — write through Claude)

## Development

```bash
npm install
npm test         # vitest, no GitHub needed (mocks)
npm run lint     # tsc --noEmit
npm run build    # next build
```

## License

MIT.
