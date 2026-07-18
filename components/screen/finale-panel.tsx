"use client";

import { motion } from "motion/react";

import type { PolicyUpdate } from "@/lib/contracts/heist";

type FinalePanelProps = {
  update?: PolicyUpdate;
  winner: "house" | "schemer";
  summary: string;
  attempts: number;
  blocked: number;
  approved: number;
};

export function FinalePanel({
  update,
  winner,
  summary,
  attempts,
  blocked,
  approved,
}: FinalePanelProps) {
  return (
    <div className="finale-stack">
      {update ? (
        <motion.section
          className="finale-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="finale-eyebrow">Breach promoted to deterministic policy</p>
          <h3 className="finale-title">{update.rule.name}</h3>
          <p className="finale-file">{update.rule.id}</p>
          <div className="finale-proof">
            <span>Exact replay blocked</span>
            <span>{update.validation.legitimateFixturesTested} legitimate fixtures passed</span>
            <span>0 false positives</span>
          </div>
        </motion.section>
      ) : null}

      <motion.section
        className={`scorecard scorecard-${winner}`}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <p className="finale-eyebrow">Heist scorecard</p>
        <div className="scorecard-grid">
          <div>
            <span>Attempts</span>
            <strong>{attempts}</strong>
          </div>
          <div>
            <span>Blocked</span>
            <strong>{blocked}</strong>
          </div>
          <div>
            <span>Breaches</span>
            <strong>{approved}</strong>
          </div>
        </div>
        <p className="scorecard-summary">{summary}</p>
      </motion.section>
    </div>
  );
}
