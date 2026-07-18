"use client";

import { motion } from "motion/react";

import type { Attempt, Verdict } from "@/lib/contracts/heist";

import { formatMoney } from "./format-money";

export type DisplayVerdict = "HOLD" | "BREACH" | "EVAL";

export function toDisplayVerdict(decision?: Verdict["decision"]): DisplayVerdict {
  if (!decision) return "EVAL";
  return decision === "BLOCKED" ? "HOLD" : "BREACH";
}

type EventRowProps = {
  attempt: Attempt;
  verdict?: Verdict;
  latencyMs?: number;
};

export function EventRow({ attempt, verdict, latencyMs }: EventRowProps) {
  const code = toDisplayVerdict(verdict?.decision);
  const rowClass =
    code === "HOLD" ? "event-row-hold" : code === "BREACH" ? "event-row-breach" : "event-row-eval";

  const evidence = [
    attempt.count > 1 ? `${attempt.count} × ${formatMoney(attempt.amount)}` : formatMoney(attempt.amount),
    attempt.vendor.toLowerCase(),
    attempt.category,
  ].join(" · ");

  return (
    <motion.article
      className={`event-row ${rowClass}${code === "EVAL" ? " event-row-scanning" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <div className="event-topline">
        <span className={`verdict-chip verdict-${code.toLowerCase()}`}>
          {code === "EVAL" ? "⋯" : code}
        </span>
        <h3 className="event-technique">{attempt.strategy}</h3>
        <span className="event-latency">
          {code === "EVAL" ? "evaluating" : latencyMs != null ? `${latencyMs}ms` : "resolved"}
        </span>
      </div>
      <p className="event-evidence">{evidence}</p>
      <div className="event-notes">
        <p className="event-intent"><span>Attacker</span>{attempt.narration}</p>
        {verdict ? (
          <p className="event-codex">
            <span>{verdict.layer === "rules" ? "Rules engine" : "Intent reviewer"}</span>
            {verdict.reason} <code>{verdict.rule}</code>
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
