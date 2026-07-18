"use client";

const COLORS = [
  { name: "paper", value: "#FBFBFC", swatch: "var(--paper)", note: "App background" },
  { name: "surface", value: "#FFFFFF", swatch: "var(--surface)", note: "Panels" },
  { name: "ink", value: "#101114", swatch: "var(--ink)", note: "Primary text" },
  { name: "ink-soft", value: "#5B5F66", swatch: "var(--ink-soft)", note: "Labels" },
  { name: "line", value: "#E7E8EC", swatch: "var(--line)", note: "Hairline borders" },
  { name: "signal", value: "#4E46E8", swatch: "var(--signal)", note: "Accent" },
  { name: "hold", value: "#0E9F6E", swatch: "var(--hold)", note: "Defense held" },
  { name: "breach", value: "#E5484D", swatch: "var(--breach)", note: "Attempt cleared" },
  { name: "watch", value: "#C77A0A", swatch: "var(--watch)", note: "Evaluating" },
];

export function StyleGuide() {
  return (
    <article className="docs-sheet style-sheet" id="styles">
      <header className="docs-hero">
        <p className="docs-eyebrow">Style reference</p>
        <h1>Patchline design system</h1>
        <p className="docs-lede">
          A security console: dense event log, hairline borders, monospace evidence, one restrained
          accent, and a single soft hero gradient. Light, confident, and projector-legible.
        </p>
      </header>

      <section>
        <h2>Principles</h2>
        <ul>
          <li>No flashcards, rubber stamps, or oversized scorecard focal points.</li>
          <li>Depth comes from hairline borders and surface/paper contrast — not drop shadows.</li>
          <li>Verdict color is never the only signal; always pair with a text code (HOLD / BREACH).</li>
          <li>One gradient only, confined to the hero band.</li>
        </ul>
      </section>

      <section>
        <h2>Color tokens</h2>
        <div className="swatch-grid">
          {COLORS.map((color) => (
            <div key={color.name} className="swatch-card">
              <div className="swatch" style={{ background: color.swatch }} />
              <strong>{color.name}</strong>
              <code>{color.value}</code>
              <span>{color.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Typography</h2>
        <div className="type-samples">
          <div>
            <span className="type-label">Display · Inter 800</span>
            <p className="type-display">Patchline</p>
          </div>
          <div>
            <span className="type-label">Body · Inter 400</span>
            <p className="type-body">
              The authorization layer between agents and the payment rail.
            </p>
          </div>
          <div>
            <span className="type-label">Evidence · JetBrains Mono 400</span>
            <p className="type-mono">$449 · amazon business · Gaming · 142ms</p>
          </div>
          <div>
            <span className="type-label">Label · Mono uppercase 11px</span>
            <p className="type-label-sample">Attack Memory</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Components</h2>
        <div className="component-samples">
          <div className="sample-block">
            <span className="type-label">Verdict chips</span>
            <div className="chip-demo">
              <span className="verdict-chip verdict-hold">HOLD</span>
              <span className="verdict-chip verdict-breach">BREACH</span>
              <span className="verdict-chip verdict-eval">⋯</span>
            </div>
          </div>
          <div className="sample-block">
            <span className="type-label">Primary button</span>
            <button className="btn-primary" type="button">
              Run probe
            </button>
          </div>
          <div className="sample-block">
            <span className="type-label">Signal outline</span>
            <button className="btn-signal" type="button">
              Harden defenses
            </button>
          </div>
          <div className="sample-block">
            <span className="type-label">Technique chip</span>
            <button className="chip" type="button">
              PS5 on the company card
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2>Event row anatomy</h2>
        <article className="event-row event-row-hold sample-event">
          <div className="event-topline">
            <span className="verdict-chip verdict-hold">HOLD</span>
            <h3 className="event-technique">Zero‑Width Category</h3>
            <span className="event-latency">142ms</span>
          </div>
          <p className="event-evidence">$449 · amazon business · Gaming</p>
          <div className="event-notes">
            <p className="event-intent">
              Invisible Unicode inserted to evade the category blocklist.
            </p>
            <p className="event-codex">
              Codex: Stripped zero‑width joiners before the category check; resolves to Gaming.
            </p>
          </div>
        </article>
      </section>

      <section>
        <h2>Spacing & radius</h2>
        <div className="docs-table">
          <div>
            <strong>--radius</strong>
            <span>10px · panels, command bar</span>
          </div>
          <div>
            <strong>--radius-sm</strong>
            <span>6px · chips, small controls</span>
          </div>
          <div>
            <strong>Content width</strong>
            <span>1240px max, centered</span>
          </div>
          <div>
            <strong>Workspace</strong>
            <span>~64% log / ~36% rail · stacks under 900px</span>
          </div>
        </div>
      </section>
    </article>
  );
}
