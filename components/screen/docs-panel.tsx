"use client";

export function DocsPanel() {
  return (
    <article className="docs-sheet" id="docs">
      <header className="docs-hero">
        <p className="docs-eyebrow">Documentation</p>
        <h1>Patchline</h1>
        <p className="docs-lede">
          The authorization layer between agents and the payment rail. A projector-facing
          simulation where GPT‑5.6 probes spend policy, Codex holds or hardens each gap, and
          validated signatures ship as a pull request. It never connects to a card, vendor, or
          purchasing tool.
        </p>
      </header>

      <section>
        <h2>What it answers</h2>
        <p>
          <strong>Can an AI get a bad expense past a two-layer defense?</strong> Rules catch the
          crude attempts. The reviewer catches intent. When something slips through, a constrained
          synthesizer promotes a narrow executable signature into Attack Memory.
        </p>
      </section>

      <section>
        <h2>Current status</h2>
        <ul>
          <li>
            <code>POST /api/heist</code> returns an SSE stream in mock or live mode.
          </li>
          <li>
            Live mode uses the OpenAI Responses API with strict JSON-schema outputs for schemer,
            reviewer, and rule synthesizer.
          </li>
          <li>
            The schemer is one streaming model call per round; reviews run while later attempts are
            still arriving.
          </li>
          <li>
            Denial feedback drives up to three adaptive rounds inside a 45-second total budget.
          </li>
          <li>
            Every approved attempt triggers synthesis, replay proof, and legitimate-fixture checks
            before in-memory installation.
          </li>
          <li>
            Screen, API mock, and browser-only Demo fallback all consume the same event contract.
          </li>
        </ul>
      </section>

      <section>
        <h2>Quick start</h2>
        <p>Requirements: Node.js 20.9 or newer (Node 24 recommended) and npm.</p>
        <pre>
          <code>{`cp .env.example .env.local
npm install
npm run dev`}</code>
        </pre>
        <p>
          Open <code>http://localhost:3000</code>. The app runs in mock mode without an API key.
        </p>
        <p>
          For live mode, set <code>OPENAI_API_KEY</code>, pin a Structured Outputs-capable{" "}
          <code>OPENAI_MODEL</code>, and set <code>HEIST_MODE=live</code> in{" "}
          <code>.env.local</code>. Never prefix the key with <code>NEXT_PUBLIC_</code>.
        </p>
      </section>

      <section>
        <h2>Checks</h2>
        <pre>
          <code>npm run check</code>
        </pre>
        <p>Lint, TypeScript, deterministic engine/SDK contract tests, and a production build.</p>
        <p>Before demo time, capture a successful live run into the offline fixture:</p>
        <pre>
          <code>{`HEIST_MODE=live npm run dev
npm run capture:fallback
npm run check`}</code>
        </pre>
      </section>

      <section>
        <h2>Lanes</h2>
        <div className="docs-table">
          <div>
            <strong>Engine</strong>
            <span>API, prompts, rules, reviewer, orchestration</span>
          </div>
          <div>
            <strong>Screen</strong>
            <span>Projector UI, interaction, animation</span>
          </div>
          <div>
            <strong>Shared</strong>
            <span>Event contract, stream client, mock/fallback fixtures</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Core documents</h2>
        <ul>
          <li>
            <code>expense-heist-spec.md</code> — build spec
          </li>
          <li>
            <code>docs/ownership.md</code> — ownership map
          </li>
          <li>
            <code>docs/architecture.md</code> — architecture
          </li>
          <li>
            <code>CONTRIBUTING.md</code> — contributing guide
          </li>
        </ul>
      </section>
    </article>
  );
}
