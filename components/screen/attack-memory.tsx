"use client";

import { AnimatePresence, motion } from "motion/react";

import type { PolicyUpdate } from "@/lib/contracts/heist";

type AttackMemoryProps = {
  entries: PolicyUpdate[];
  highlightedId?: string | null;
};

export function AttackMemory({ entries, highlightedId }: AttackMemoryProps) {
  return (
    <aside className="memory-panel" aria-label="Hardened policy signatures">
      <div className="section-heading">
        <h2>Hardened Policy</h2>
        <span>{entries.length ? `${entries.length} installed` : "Baseline"}</span>
      </div>

      {entries.length === 0 ? (
        <div className="memory-empty">
          <p className="memory-empty-title">No promoted signatures yet</p>
          <p className="memory-empty-copy">
            A successful attack becomes a narrow executable rule after validation.
          </p>
        </div>
      ) : (
        <ul className="memory-list">
          <AnimatePresence initial={false}>
            {entries.map((entry) => {
              const hit = entry.rule.id === highlightedId;
              return (
                <motion.li
                  key={entry.rule.id}
                  className={`memory-entry${hit ? " memory-entry-hit" : ""}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <span className="memory-label">{entry.rule.name}</span>
                  <span className="memory-summary">{entry.rule.reason}</span>
                  <code>{entry.rule.id}</code>
                  <small>
                    Replay blocked · {entry.validation.legitimateFixturesTested} fixtures · 0 false positives
                  </small>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
