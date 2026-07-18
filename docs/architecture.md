# Architecture

The dependency direction is deliberately one-way:

```text
components/screen ──reads──> lib/contracts <──reads── lib/engine
       │                         ▲                  │
       └──── POST /api/heist ────┴──── app/api ────┘
```

- `lib/contracts` contains data shapes and browser stream parsing. It imports from neither lane.
- `lib/engine` contains pure policy logic and OpenAI-backed orchestration. It never imports React.
- `components/screen` renders contract events. It must not import server-only OpenAI code.
- `app/api/heist/route.ts` is the composition root. It selects the deterministic replay or live orchestrator from server-only environment configuration.

## Engine boundaries

- `rules.ts` is pure and deterministic. It has no network or model dependency.
- `validation.ts` treats every model response as untrusted, even after Structured Outputs.
- `streaming-json.ts` extracts only balanced, complete attempt objects from strict schemer JSON.
- `prompts.ts` keeps the wish and model-created history inside explicit untrusted JSON data.
- `openai-model.ts` is the only OpenAI SDK adapter. It attaches no tools and stores no response.
- `rule-synthesis.ts` is the semantic compiler gate: executable grammar, replay proof, and fixture regression check.
- `policy-store.ts` owns a bounded, process-local signature registry; rules remain pure inputs to `rules.ts`.
- `heist.ts` owns ordering, reviewer concurrency, adaptation, synthesis retries, aborts, and the total deadline.
- `errors.ts` maps internal failures to projector-readable messages without leaking credentials.

## Stream lifecycle

1. The screen sends `POST /api/heist` with `{ "wish": string }`.
2. The route responds with `text/event-stream`.
3. Each SSE frame contains one serialized `HeistEvent` in a `data:` line.
4. One schemer response streams strict JSON. The parser emits a `round` and each complete `attempt` as soon as its object closes.
5. Rule/reviewer evaluation begins immediately. Verdicts may interleave with later attempts and update cards by `attemptId`.
6. An approval triggers rule synthesis. The server installs only a candidate that blocks the replay and matches zero legitimate fixtures.
7. The resulting `round_end.policyUpdate` is the proof displayed by the screen.
8. Exactly one terminal `end` or `error` event unlocks the input.

The orchestrator races the next schemer chunk against every pending verdict. Rule results resolve
immediately; passing attempts enter a three-worker reviewer queue. A verdict may arrive before later
attempts, but never before its own matching attempt. The completed structured output is parsed again
and compared with every streamed object before a round can end.

Because the request is a POST, the browser uses a streaming `fetch()` reader rather than native `EventSource`.

## Runtime modes

- `HEIST_MODE=mock`: compact timed fixture, no API key, normal development default.
- `HEIST_MODE=live`: real schemer/reviewer/synthesizer execution through the Responses API.
- Demo fallback: the visible **Demo fallback** control replays `lib/fallback.json` through `lib/mock.ts` without any network request.

The live implementation must keep `OPENAI_API_KEY` server-only. No purchasing or payment tool is ever attached; this is a policy-evaluation simulation.

## Adaptation and calibration

- All blocked: denial codes and reasons feed the next schemer round, up to three total rounds.
- Any approved: the earliest approved attempt is promoted, validated, installed, and replayed. The
  heist ends only after the hardening proof is attached to `round_end`.
- Later heists in the same process receive installed signatures in the schemer context and rules
  engine. This is signature promotion, not training.
- `calibration.ts` assigns about 20% of heists a permissive reviewer evidence posture. Deterministic
  policy rules, including synthesized signatures, are always evaluated first and cannot be bypassed.
