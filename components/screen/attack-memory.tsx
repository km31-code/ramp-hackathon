"use client";

import { AnimatePresence, motion } from "motion/react";

import type { PolicyUpdate } from "@/lib/contracts/heist";

type AttackMemoryProps = {
  entries: PolicyUpdate[];
  highlightedId?: string | null;
  runId?: string;
};

export function AttackMemory({ entries, highlightedId, runId }: AttackMemoryProps) {
  return (
    <aside className="panel rail-block" id="memory" aria-label="Attack memory">
      <div className="panel-header">
        <h2>Attack Memory</h2>
        <span className="panel-meta">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <div className="memory-empty">
          <p className="memory-empty-title">No patterns learned</p>
          <p className="memory-empty-copy">
            When a breach is validated, Codex stores a narrow signature here.
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
                  <span className="memory-meta">
                    learned {runId ?? entry.rule.id.toLowerCase()}
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
