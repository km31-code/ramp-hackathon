"use client";

import { useMemo, useState } from "react";

import type { PolicyUpdate } from "@/lib/contracts/heist";

type HardenPanelProps = {
  update?: PolicyUpdate;
  runId: string;
  onPatched?: () => void;
};

export function HardenPanel({ update, runId, onPatched }: HardenPanelProps) {
  const [open, setOpen] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);

  const diff = useMemo(() => {
    if (!update) return "";
    const rule = update.rule;
    return [
      `+ rule: ${rule.id.toLowerCase()}`,
      `+   match: wish/vendor/category signature`,
      `+   action: hold`,
      `+   source: memory/${runId}`,
      rule.vendorEquals ? `+   vendorEquals: ${rule.vendorEquals}` : null,
      rule.categoryEquals ? `+   categoryEquals: ${rule.categoryEquals}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, [update, runId]);

  if (!update) return null;

  function handleHarden() {
    setShipping(true);
    window.setTimeout(() => {
      setShipping(false);
      setOpen(true);
      setShipped(true);
      onPatched?.();
    }, 700);
  }

  return (
    <section className="panel rail-block" id="rules" aria-label="Harden defenses">
      <div className="panel-header">
        <h2>Harden</h2>
      </div>

      <p className="harden-copy">
        1 unpatched technique — harden to make the fix permanent.
      </p>

      {!open ? (
        <button className="btn-signal" type="button" disabled={shipping} onClick={handleHarden}>
          {shipping ? "shipping…" : "Harden defenses"}
        </button>
      ) : null}

      {open ? (
        <div className="harden-diff">
          <p className="harden-branch">branch · patch/{update.rule.id.toLowerCase()}</p>
          <p className="harden-title">feat: patch {update.rule.id.toLowerCase()}</p>
          <pre>
            <code>{diff}</code>
          </pre>
          {shipped ? (
            <p className="harden-shipped">Patch shipped · preview</p>
          ) : null}
          <p className="harden-note">
            No GitHub token — showing the diff. Set GITHUB_TOKEN to open a real PR.
          </p>
        </div>
      ) : null}
    </section>
  );
}
