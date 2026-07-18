"use client";

import { AnimatePresence } from "motion/react";

import type { Attempt, Verdict } from "@/lib/contracts/heist";

import { EventRow } from "./event-row";

type SessionLogProps = {
  runId: string;
  statusLabel: string;
  attempts: Array<{ attempt: Attempt; verdict?: Verdict; latencyMs?: number }>;
  errorMessage?: string;
  hardening?: boolean;
};

export function SessionLog({
  runId,
  statusLabel,
  attempts,
  errorMessage,
  hardening,
}: SessionLogProps) {
  return (
    <section className="panel session-log" aria-label="Session log">
      <div className="panel-header">
        <h2>Session</h2>
        <span className="panel-meta">
          {runId} · {statusLabel}
        </span>
      </div>

      {errorMessage ? (
        <p className="stream-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {hardening ? (
        <div className="hardening-banner" role="status" aria-live="polite">
          <p>
            <strong>Compiling a narrow deterministic signature</strong>
            Breach found — synthesizer active. Policy updates only after every proof passes.
          </p>
        </div>
      ) : null}

      <div className="event-list" aria-live="polite">
        <AnimatePresence initial={false}>
          {attempts.map(({ attempt, verdict, latencyMs }) => (
            <EventRow
              key={attempt.id}
              attempt={attempt}
              verdict={verdict}
              latencyMs={latencyMs}
            />
          ))}
        </AnimatePresence>

        {!attempts.length && !hardening ? (
          <div className="log-empty">
            <p>
              Run a probe to stream adversarial techniques through rules, semantic review, and
              policy hardening.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
