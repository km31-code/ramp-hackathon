# Architecture

The dependency direction is deliberately one-way:

```text
components/screen ──reads──> lib/contracts <──reads── lib/engine
       │                         ▲                  │
       └──── POST /api/heist ────┴──── app/api ────┘
```

- `lib/contracts` contains data shapes and browser stream parsing. It imports from neither lane.
- `lib/engine` contains pure policy logic and, later, OpenAI-backed orchestration. It must not import React.
- `components/screen` renders contract events. It must not import server-only OpenAI code.
- `app/api/heist/route.ts` is the composition root. Today it streams the mock; the Engine lane replaces that source with the live orchestrator.

## Stream lifecycle

1. The screen sends `POST /api/heist` with `{ "wish": string }`.
2. The route responds with `text/event-stream`.
3. Each SSE frame contains one serialized `HeistEvent` in a `data:` line.
4. Attempts are rendered as soon as they are emitted.
5. Verdicts may arrive later and update cards by `attemptId`.
6. Exactly one terminal `end` or `error` event unlocks the input.

Because the request is a POST, the browser uses a streaming `fetch()` reader rather than native `EventSource`.

## Runtime modes

- `HEIST_MODE=mock`: deterministic, no API key, normal development default.
- `HEIST_MODE=live`: real schemer/reviewer implementation once the Engine lane wires it.
- Demo fallback: the visible **Demo fallback** control replays `lib/mock.ts` without any network request.

The live implementation must keep `OPENAI_API_KEY` server-only. No purchasing or payment tool is ever attached; this is a policy-evaluation simulation.
