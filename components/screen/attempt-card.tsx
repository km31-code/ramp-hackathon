"use client";

import { motion } from "motion/react";

import type { Attempt, Decision, Verdict } from "@/lib/contracts/heist";

import { formatMoney } from "./format-money";

type AttemptCardProps = {
  attempt: Attempt;
  verdict?: Verdict;
  compact?: boolean;
  /** When decision flips across rounds, restamp with a harder slam. */
  restampKey?: string;
};

export function AttemptCard({
  attempt,
  verdict,
  compact = false,
  restampKey,
}: AttemptCardProps) {
  const intensity = Math.min(attempt.round, 3);
  const decision = verdict?.decision;
  const stampScale = decision === "BLOCKED" && intensity >= 2 ? 1.55 : 1.45;

  if (compact) {
    return (
      <motion.article
        className="attempt-card attempt-card-compact"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <div className="attempt-topline">
          <h3>{attempt.strategy}</h3>
          <Stamp decision={decision} compact />
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      className={`attempt-card attempt-card-r${intensity}`}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <div className="attempt-topline">
        <h3>{attempt.strategy}</h3>
        {verdict ? (
          <Stamp
            decision={verdict.decision}
            restampKey={restampKey ?? `${verdict.attemptId}-${verdict.decision}`}
            scale={stampScale}
          />
        ) : (
          <span className="pending">Evaluating</span>
        )}
      </div>
      <p className="ledger-line">
        {attempt.count > 1 ? `${attempt.count} × ` : ""}
        {formatMoney(attempt.amount)} · {attempt.vendor}
        <span className="ledger-category"> · {attempt.category}</span>
      </p>
      <p className="narration">“{attempt.narration}”</p>
      {verdict ? (
        <p className="verdict-reason">
          <span>{verdict.layer}</span>
          {verdict.reason}
        </p>
      ) : null}
    </motion.article>
  );
}

function Stamp({
  decision,
  compact,
  restampKey,
  scale = 1.45,
}: {
  decision?: Decision;
  compact?: boolean;
  restampKey?: string;
  scale?: number;
}) {
  if (!decision) return <span className="pending">Evaluating</span>;

  return (
    <motion.span
      key={restampKey ?? decision}
      className={`stamp stamp-${decision.toLowerCase()}${compact ? " stamp-compact" : ""}`}
      initial={{ opacity: 0, rotate: decision === "BLOCKED" ? -12 : -6, scale }}
      animate={{ opacity: 1, rotate: -2, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {decision}
    </motion.span>
  );
}
