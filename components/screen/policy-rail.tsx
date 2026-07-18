"use client";

import { motion } from "motion/react";

import { POLICY } from "@/lib/contracts/policy";

import { formatMoney } from "./format-money";
import type { LeaderboardEntry } from "./leaderboard";

type PolicyRailProps = {
  finalWinner?: "house" | "schemer";
  finalSummary?: string;
  leaderboard: LeaderboardEntry[];
};

export function PolicyRail({ finalWinner, finalSummary, leaderboard }: PolicyRailProps) {
  return (
    <aside className="policy-panel">
      <div className="section-heading">
        <h2>Policy</h2>
        <span>Weak baseline → learned rules</span>
      </div>

      <dl className="policy-list">
        <div>
          <dt>Single charge</dt>
          <dd>{formatMoney(POLICY.SINGLE_TXN_LIMIT)}</dd>
        </div>
        <div>
          <dt>Round total</dt>
          <dd>{formatMoney(POLICY.ROUND_TOTAL_LIMIT)}</dd>
        </div>
        <div>
          <dt>Blocked categories</dt>
          <dd>{POLICY.BLOCKED_CATEGORIES.length}</dd>
        </div>
        <div>
          <dt>Approved vendors</dt>
          <dd>{POLICY.APPROVED_VENDORS.length}</dd>
        </div>
      </dl>

      <div className="layer-explainer">
        <p>
          <strong>01 / Rules</strong>
          Narrow deterministic checks with deliberate gaps
        </p>
        <p>
          <strong>02 / Reviewer</strong>
          Pattern and intent across the round
        </p>
        <p>
          <strong>03 / Synthesizer</strong>
          Promotes a validated breach signature into deterministic policy
        </p>
      </div>

      {finalWinner && finalSummary ? (
        <motion.div
          className={`final-state final-${finalWinner}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>{finalWinner === "house" ? "Policy held" : "Policy breached"}</span>
          <p>{finalSummary}</p>
        </motion.div>
      ) : null}

      <div className="leaderboard">
        <div className="section-heading">
          <h2>Leaderboard</h2>
          <span>Local</span>
        </div>
        {leaderboard.length ? (
          <ol className="leaderboard-list">
            {leaderboard.map((entry) => (
              <li key={`${entry.at}-${entry.wish}`}>
                <span className="leaderboard-wish">“{entry.wish}”</span>
                <span className={`leaderboard-outcome outcome-${entry.outcome}`}>
                  {entry.outcome === "breached" ? `Broke it · r${entry.round}` : "Held"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="leaderboard-empty">No breaches yet. The house is winning.</p>
        )}
      </div>
    </aside>
  );
}
