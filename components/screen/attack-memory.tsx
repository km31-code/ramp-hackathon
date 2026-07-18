"use client";

import { AnimatePresence, motion } from "motion/react";

import type { MemoryEntry } from "@/lib/contracts/heist";

type AttackMemoryProps = {
  entries: MemoryEntry[];
  highlightedId?: string | null;
};

export function AttackMemory({ entries, highlightedId }: AttackMemoryProps) {
  return (
    <aside className="memory-panel" aria-label="Attack Memory">
      <div className="section-heading">
        <h2>Attack Memory</h2>
        <span>{entries.length ? `${entries.length} stored` : "Empty"}</span>
      </div>

      {entries.length === 0 ? (
        <div className="memory-empty">
          <p className="memory-empty-title">No patterns learned</p>
          <p className="memory-empty-copy">
            When an attack succeeds, the defense stores it here.
          </p>
        </div>
      ) : (
        <ul className="memory-list">
          <AnimatePresence initial={false}>
            {entries.map((entry) => {
              const hit = entry.id === highlightedId;
              return (
                <motion.li
                  key={entry.id}
                  className={`memory-entry${hit ? " memory-entry-hit" : ""}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <span className="memory-label">{entry.label}</span>
                  <span className="memory-summary">{entry.summary}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
