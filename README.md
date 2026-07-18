# Expense Heist

Expense Heist is a projector-facing simulation: a schemer model proposes ways to disguise an out-of-policy purchase, while deterministic rules and a reviewer model explain why each attempt is blocked. It never connects to a card, vendor, or purchasing tool.

The demo question is simple: **can an AI get a bad expense past a two-layer defense?**

## Current status

The repository begins with a complete mock vertical slice:

- `POST /api/heist` returns an SSE stream.
- The screen parses the stream and renders attempts and verdicts live.
- The same event contract drives both the API mock and the offline fallback.
- The deterministic policy engine has a stable module boundary.

The real OpenAI-backed schemer and reviewer intentionally remain isolated work for the engine lane.

## Quick start

Requirements: Node.js 20.9 or newer (Node 24 recommended) and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in mock mode without an API key.

Before opening a pull request:

```bash
npm run check
```

Commit `package-lock.json` with dependency changes so everyone and CI use the same dependency graph.

## Two-person split

| Lane | Owns | Primary paths | Branch prefix |
| --- | --- | --- | --- |
| Engine | API, prompts, rules, reviewer, orchestration | `app/api/**`, `lib/engine/**` | `engine/` |
| Screen | projector UI, interaction, animation, local leaderboard | `app/page.tsx`, `app/globals.css`, `components/screen/**` | `screen/` |
| Shared | event/request types, stream client, mock/fallback fixtures | `lib/contracts/**`, `lib/mock.ts` | `contract/` |

Changes to the shared lane need both people to review. See [the ownership map](docs/ownership.md) and [architecture notes](docs/architecture.md).

## Collaboration workflow

1. Pick or create one GitHub issue using the Engine, Screen, or Integration template.
2. Create a short-lived branch from current `main`, such as `engine/reviewer` or `screen/verdict-stamp`.
3. Keep the pull request narrow and mark the affected lane in the PR template.
4. Rebase or merge the latest `main` before requesting review.
5. Require the other person’s review for `lib/contracts/**` or `lib/mock.ts` changes.
6. Squash-merge after CI passes; delete the branch.

Avoid both people editing `app/page.tsx`, `app/api/heist/route.ts`, or the contract in the same hour. If the contract must change, make that a tiny contract-only PR first.

## Repository setup on GitHub

After the initial commit is pushed:

1. Invite the other builder in **Settings → Collaborators → Add people**.
2. Ask them to accept the invitation, clone the repository, run `npm install`, and create their lane branch.
3. Update `.github/CODEOWNERS` with their real GitHub username and the lane assignment from `docs/ownership.md`.
4. Add a `main` branch ruleset requiring a pull request, one approval, and the `check` workflow.
5. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, and `HEIST_MODE=live` only in the Vercel project’s server-side environment. Never commit `.env.local`.

Someone without collaborator access can still fork this public repository and send a pull request.

## Core documents

- [Build spec](expense-heist-spec.md)
- [Ownership map](docs/ownership.md)
- [Architecture](docs/architecture.md)
- [Contributing guide](CONTRIBUTING.md)
