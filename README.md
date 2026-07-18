# Expense Heist

Expense Heist is a projector-facing simulation: a schemer model proposes ways to disguise an out-of-policy purchase, deterministic rules and a reviewer model evaluate each attempt, and a constrained synthesizer promotes any breach into a validated executable signature. It never connects to a card, vendor, or purchasing tool.

The demo question is simple: **can an AI get a bad expense past a two-layer defense?**

## Current status

The repository includes both a deterministic demo path and the complete live engine:

- `POST /api/heist` returns an SSE stream in mock or live mode.
- Live mode uses the OpenAI Responses API with strict JSON-schema outputs for the schemer, reviewer, and rule synthesizer.
- The schemer is one streaming model call per round. A bounded JSON parser emits each completed attempt object immediately; reviews run while later attempts are still arriving.
- The rules layer is deterministic; intent reviews run concurrently with a hard cap of three.
- Every heist runs three adaptive rounds inside a 90-second total budget. Verdicts and newly hardened rules feed the next round.
- Every approved attempt triggers synthesis. Candidate rules are limited to a fixed grammar, retried once if rejected, replay-tested against the breach, and tested against 12 legitimate purchase fixtures before in-memory installation.
- One deterministic heist bucket in five uses a permissive semantic evidence posture. It never bypasses hard rules; it leaves a measurable reviewer gap so the house can lose.
- The screen, three-round API mock, and browser-only fallback all consume the same event contract.
- `lib/mock.ts` contains a compact 14-event, 300–600ms UI replay. `lib/fallback.json` contains a full three-round breach-and-hardening replay for venue-wifi or API failures.

## Quick start

Requirements: Node.js 20.9 or newer (Node 24 recommended) and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in mock mode without an API key.

For live mode, set `OPENAI_API_KEY`, pin a Structured Outputs-capable `OPENAI_MODEL`, and set
`HEIST_MODE=live` in `.env.local`. These values are read only by the Node.js route handler; never
prefix the key with `NEXT_PUBLIC_`.

Before opening a pull request:

```bash
npm run check
```

The check includes lint, TypeScript, deterministic engine/SDK contract tests, and a production build.

Before demo time, capture a successful live run into the offline fixture:

```bash
HEIST_MODE=live npm run dev
npm run capture:fallback
npm run check
```

The capture command refuses mock streams, error streams, incomplete verdicts, and unproven breach
hardening. Every capture must show all three rounds; a schemer win must contain at least one
replay-proven, zero-fixture-regression policy update. It replaces the fixture only after the full stream validates.

Promoted rules live only in the current Node.js process, with a bounded 64-rule store. Restarting or
moving to another server instance clears them by design; there are no accounts or persistence.

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
