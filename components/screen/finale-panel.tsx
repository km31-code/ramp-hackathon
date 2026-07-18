"use client";

import { motion } from "motion/react";

import type { Scorecard } from "@/lib/contracts/heist";

type FinalePanelProps = {
  patch?: { title: string; filename: string; diff: string };
  pr?: {
    status: "opened" | "preview";
    title: string;
    url?: string;
    body?: string;
  };
  persistCount?: number;
  scorecard?: Scorecard;
  summary?: string;
};

export function FinalePanel({
  patch,
  pr,
  persistCount,
  scorecard,
  summary,
}: FinalePanelProps) {
  if (!patch && !pr && !scorecard) return null;

  return (
    <div className="finale-stack">
      {patch ? (
        <motion.section
          className="finale-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="finale-eyebrow">Making it permanent</p>
          <h3 className="finale-title">{patch.title}</h3>
          <p className="finale-file">{patch.filename}</p>
          <pre className="finale-diff">
            <code>{patch.diff}</code>
          </pre>
        </motion.section>
      ) : null}

      {persistCount != null ? (
        <motion.p
          className="finale-persist"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Saved {persistCount} patterns to the attack-memory database.
        </motion.p>
      ) : null}

      {pr ? (
        <motion.section
          className={`finale-card finale-pr finale-pr-${pr.status}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="finale-eyebrow">
            {pr.status === "opened" ? "Pull request opened" : "Pull request preview"}
          </p>
          <h3 className="finale-title">{pr.title}</h3>
          {pr.body ? <p className="finale-pr-body">{pr.body}</p> : null}
          {pr.url ? (
            <a className="finale-pr-link" href={pr.url} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          ) : (
            <p className="finale-pr-note">
              No GitHub token — showing the diff preview so the demo never fails cold.
            </p>
          )}
        </motion.section>
      ) : null}

      {scorecard ? (
        <motion.section
          className="scorecard"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="finale-eyebrow">Scorecard</p>
          <div className="scorecard-grid">
            <div>
              <span>Round 1 successes</span>
              <strong>{scorecard.breaches}</strong>
            </div>
            <div>
              <span>Patterns learned</span>
              <strong>{scorecard.patternsLearned}</strong>
            </div>
            <div>
              <span>PR shipped</span>
              <strong>{scorecard.prShipped ? 1 : 0}</strong>
            </div>
          </div>
          {summary ? <p className="scorecard-summary">{summary}</p> : null}
        </motion.section>
      ) : null}
    </div>
  );
}
