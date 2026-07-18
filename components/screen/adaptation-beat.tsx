"use client";

import { motion } from "motion/react";

type AdaptationBeatProps = {
  fromRound: number;
  learnedRules: string[];
  nextTaunt?: string;
};

export function AdaptationBeat({ fromRound, learnedRules, nextTaunt }: AdaptationBeatProps) {
  return (
    <motion.div
      className="adaptation-beat"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
    >
      <p className="adaptation-eyebrow">Round {fromRound} blocked — schemer adapting</p>
      <h2 className="adaptation-title">Learning from the denial</h2>

      {learnedRules.length ? (
        <ul className="learned-chips">
          {learnedRules.map((rule, index) => (
            <motion.li
              key={rule}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.3 }}
            >
              {rule.replaceAll("_", " ")}
            </motion.li>
          ))}
        </ul>
      ) : null}

      {nextTaunt ? (
        <motion.p
          className="adaptation-taunt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          “{nextTaunt}”
        </motion.p>
      ) : (
        <p className="adaptation-taunt adaptation-taunt-pending">Forming a new angle…</p>
      )}
    </motion.div>
  );
}
