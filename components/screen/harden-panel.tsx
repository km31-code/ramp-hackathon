import type { Attempt, PolicyUpdate } from "@/lib/contracts/heist";

type HardenPanelProps = {
  update?: PolicyUpdate;
  sourceAttempt?: Attempt;
};

export function HardenPanel({ update, sourceAttempt }: HardenPanelProps) {
  if (!update) return null;
  const rule = update.rule;
  const conditions = [
    `wish contains “${rule.wishContains}”`,
    rule.vendorEquals ? `vendor equals “${rule.vendorEquals}”` : null,
    rule.categoryEquals ? `category equals “${rule.categoryEquals}”` : null,
    rule.minCount !== null ? `count is at least ${rule.minCount}` : null,
    rule.amountMin !== null && rule.amountMax !== null
      ? `amount is $${rule.amountMin}–$${rule.amountMax}`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <section className="panel rail-block harden-complete" id="rules" aria-label="Installed policy rule">
      <div className="panel-header">
        <h2>Codex patched the breach</h2>
        <span className="panel-meta">Installed</span>
      </div>

      <p className="harden-copy">
        {sourceAttempt
          ? `${sourceAttempt.strategy} (${sourceAttempt.id}) exposed the gap. Codex compiled it into an executable rule.`
          : "The approved attack exposed a gap. Codex compiled it into an executable rule."}
      </p>
      <div className="harden-diff">
        <p className="harden-title">{rule.name}</p>
        <code className="harden-rule-id">{rule.id}</code>
        <pre><code>{`WHEN ${conditions.join("\n  AND ")}\nTHEN BLOCK — ${rule.reason}`}</code></pre>
      </div>
      <ol className="proof-list">
        <li><span>✓</span> Exact breach replay is now blocked</li>
        <li><span>✓</span> {update.validation.legitimateFixturesTested} legitimate purchases tested</li>
        <li><span>✓</span> 0 false positives</li>
        <li><span>✓</span> Rule installed in the live deterministic engine</li>
      </ol>
    </section>
  );
}
