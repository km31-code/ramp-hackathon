"use client";

import { AnimatePresence } from "motion/react";

import type { Attempt, PolicyUpdate, Verdict } from "@/lib/contracts/heist";

import { EventRow } from "./event-row";

export type SessionPhase = "idle" | "round" | "adapting" | "hardening" | "ended" | "error";

export interface SessionAttempt {
  attempt: Attempt;
  verdict?: Verdict;
}

export interface SessionRound {
  round: number;
  taunt: string;
  attempts: SessionAttempt[];
  allBlocked?: boolean;
  policyUpdate?: PolicyUpdate;
}

type SessionLogProps = {
  runId: string;
  statusLabel: string;
  rounds: SessionRound[];
  phase: SessionPhase;
  running: boolean;
  errorMessage?: string;
  finalSummary?: string;
  finalWinner?: "house" | "schemer";
};

function RunStatus({
  phase,
  running,
  rounds,
  finalSummary,
  finalWinner,
}: Pick<SessionLogProps, "phase" | "running" | "rounds" | "finalSummary" | "finalWinner">) {
  const activeRound = rounds.at(-1);

  if (phase === "hardening") {
    return (
      <div className="run-status run-status-hardening" role="status" aria-live="polite">
        <div>
          <span className="run-status-kicker">Breach found · Codex is working</span>
          <strong>Building and validating a new policy rule…</strong>
        </div>
        <ol className="hardening-steps" aria-label="Policy hardening progress">
          <li className="step-done"><span>1</span>Capture</li>
          <li className="step-active"><span>2</span>Build rule</li>
          <li><span>3</span>Validate + install</li>
        </ol>
      </div>
    );
  }

  if (phase === "adapting") {
    return (
      <div className="run-status run-status-adapting" role="status" aria-live="polite">
        <span className="run-status-kicker">Round {activeRound?.round} complete</span>
        <strong>
          {activeRound?.policyUpdate
            ? "Codex patched the breach. Attacker is adapting…"
            : "Attacker is adapting to the denials…"}
        </strong>
      </div>
    );
  }

  if (phase === "ended" && finalSummary) {
    return (
      <div className={`run-status run-status-ended run-status-${finalWinner ?? "house"}`} role="status">
        <span className="run-status-kicker">
          {finalWinner === "schemer" ? "Breach found · defense hardened" : "Defense held all three rounds"}
        </span>
        <strong>{finalWinner === "schemer" ? "Breach found, patched, and retested." : "The house held every round."}</strong>
        <p>{finalSummary}</p>
      </div>
    );
  }

  if (phase === "round" && activeRound) {
    return null;
  }

  if (running) {
    return (
      <div className="run-status run-status-live" role="status" aria-live="polite">
        <span className="run-status-kicker">Live model request</span>
        <strong>Generating seven different attacks…</strong>
      </div>
    );
  }

  return null;
}

export function SessionLog({
  runId,
  statusLabel,
  rounds,
  phase,
  running,
  errorMessage,
  finalSummary,
  finalWinner,
}: SessionLogProps) {
  const latestRound = rounds.at(-1)?.round ?? 0;

  return (
    <section className="panel session-log" aria-label="Live attack session">
      <div className="panel-header">
        <h2>Attack timeline</h2>
        <span className="panel-meta">
          {runId} · {statusLabel}
        </span>
      </div>

      {errorMessage ? (
        <p className="stream-error" role="alert">
          Live run stopped: {errorMessage}
        </p>
      ) : null}

      <RunStatus
        phase={phase}
        running={running}
        rounds={rounds}
        finalSummary={finalSummary}
        finalWinner={finalWinner}
      />

      <div className="event-list" aria-live="polite">
        {[...rounds].reverse().map((round) => {
          const resolved = round.attempts.filter(({ verdict }) => verdict).length;
          const breached = round.attempts.some(({ verdict }) => verdict?.decision === "APPROVED");
          const complete = round.allBlocked !== undefined;

          return (
            <section className="round-block" key={round.round} aria-label={`Round ${round.round}`}>
              <header className="round-header">
                <div>
                  <p className="round-kicker">
                    {round.round === 1 ? "Initial attack batch" : "Adapted attack batch"}
                  </p>
                  <h3>Round {round.round} of 3</h3>
                </div>
                <span className="round-progress">
                  {round.attempts.length}/7 streamed · {resolved} resolved
                </span>
              </header>

              <p className="round-taunt">
                <span>{round.round > 1 ? "Adapted attacker" : "Schemer"}</span> “{round.taunt}”
              </p>

              <AnimatePresence initial={false}>
                {round.attempts.map(({ attempt, verdict }) => (
                  <EventRow
                    key={attempt.id}
                    attempt={attempt}
                    verdict={verdict}
                  />
                ))}
              </AnimatePresence>

              {complete ? (
                <div className={`round-outcome ${breached ? "round-outcome-breach" : "round-outcome-held"}`}>
                  <strong>{breached ? "Breach found" : `All ${round.attempts.length} attacks blocked`}</strong>
                  <span>
                    {breached && round.policyUpdate
                      ? round.round < 3
                        ? `${round.policyUpdate.rule.id} installed. Round ${round.round + 1} attacks the stronger policy.`
                        : `${round.policyUpdate.rule.id} installed after the final-round breach.`
                      : breached
                        ? "Codex is turning this breach into a policy rule."
                        : round.round < 3 && round.round === latestRound && phase !== "ended"
                          ? "The denials went back to the attacker for a smarter next round."
                          : round.round < 3
                            ? `Round ${round.round + 1} used this feedback.`
                            : "The attacker exhausted the three-round limit."}
                  </span>
                </div>
              ) : null}
            </section>
          );
        })}

        {!rounds.length && !running ? (
          <div className="log-empty">
            <strong>Give the adversary a wish to begin.</strong>
            <p>Watch 21 attacks across three rounds. Breaches become new policy rules.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
