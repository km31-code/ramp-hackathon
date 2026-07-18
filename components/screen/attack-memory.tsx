"use client";

import { AnimatePresence, motion } from "motion/react";

import type { PolicyUpdate } from "@/lib/contracts/heist";

type AttackMemoryProps = {
  entries: PolicyUpdate[];
  highlightedId?: string | null;
};

function predicates(entry: PolicyUpdate): string[] {
  const rule = entry.rule;
  return [
    `wish contains “${rule.wishContains}”`,
    rule.vendorEquals ? `vendor = ${rule.vendorEquals}` : null,
    rule.categoryEquals ? `category = ${rule.categoryEquals}` : null,
    rule.minCount !== null ? `count ≥ ${rule.minCount}` : null,
    rule.amountMin !== null && rule.amountMax !== null
      ? `$${rule.amountMin}–$${rule.amountMax}`
      : null,
  ].filter((item): item is string => item !== null);
}

export function AttackMemory({ entries, highlightedId }: AttackMemoryProps) {
  return (
    <aside className="panel rail-block" id="memory" aria-label="Hardened policy rules">
      <div className="panel-header">
        <h2>Hardened Policy</h2>
        <span className="panel-meta">{entries.length} installed</span>
      </div>

      {entries.length === 0 ? (
        <div className="memory-empty">
          <p className="memory-empty-title">No breach-derived rules yet</p>
          <p className="memory-empty-copy">
            When an attack breaches, Codex validates and installs its narrow signature here.
          </p>
        </div>
      ) : (
        <ul className="memory-list">
          <AnimatePresence initial={false}>
            {[...entries].reverse().map((entry) => {
              const hit = entry.rule.id === highlightedId;
              return (
                <motion.li
                  key={entry.rule.id}
                  className={`memory-entry${hit ? " memory-entry-hit" : ""}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <span className="memory-label">{entry.rule.name}</span>
                  <span className="memory-summary">{entry.rule.reason}</span>
                  <code className="memory-rule-id">{entry.rule.id}</code>
                  <span className="memory-predicates">{predicates(entry).join(" · ")}</span>
                  <span className="memory-proof">
                    Replay blocked · {entry.validation.legitimateFixturesTested} legitimate fixtures · 0 false positives
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
