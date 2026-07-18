# Repository instructions

- Read `expense-heist-spec.md` and `docs/ownership.md` before changing behavior.
- Respect the Engine, Screen, and Shared path boundaries in `README.md`.
- Treat `lib/contracts/**` and `lib/mock.ts` as jointly reviewed interfaces.
- Keep the OpenAI API key server-only and never use a `NEXT_PUBLIC_` secret.
- The app is a simulation; do not add real card, purchasing, or vendor-execution tools.
- Preserve mock mode and the offline fallback when adding live behavior.
- Run `npm run check` before handing off a change.
- Do not silently change the streamed event contract; update types, fixture, API, screen, and spec together.
