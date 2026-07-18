# Contributing

## Before you start

- Claim a GitHub issue and confirm its lane.
- Pull current `main`.
- Create a branch named `engine/<topic>`, `screen/<topic>`, `contract/<topic>`, or `integration/<topic>`.
- Copy `.env.example` to `.env.local`; do not share secrets in commits, issues, screenshots, or chat.

## Ownership rule

Engine and Screen contributors may merge within their own path after review. Any edit to `lib/contracts/**`, `lib/mock.ts`, dependency versions, or the deployment workflow needs both builders to review because it can block both lanes.

## Definition of done

- The affected flow works in mock mode.
- `npm run check` passes.
- New error states are visible and readable.
- The PR contains no secrets or generated `.next` output.
- Contract changes include matching mock events and consumer updates.
- The PR description says exactly how a reviewer can verify it.

## Commit style

Use short, imperative commits with an optional lane:

```text
engine: add deterministic vendor checks
screen: animate blocked verdict stamp
contract: add escalation taunt event
```

Keep generated dependency lockfile changes in the same PR as the dependency change that caused them.
