"use client";

import { AnimatePresence } from "motion/react";

import type { Attempt, Verdict } from "@/lib/contracts/heist";

import { EventRow } from "./event-row";

export type SessionPhase = "idle" | "round" | "adapting" | "hardening" | "ended" | "error";

export interface SessionAttempt {
  attempt: Attempt;
  verdict?: Verdict;
  latencyMs?: number;
}

export interface SessionRound {
  round: number;
  taunt: string;
  attempts: SessionAttempt[];
  allBlocked?: boolean;
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
          <span className="run-status-kicker">Breach response · Codex is working</span>
          <strong>Converting the successful attack into a narrow executable rule</strong>
          <p>The run stays open while replay and legitimate-purchase safety checks finish.</p>
        </div>
        <ol className="hardening-steps" aria-label="Policy hardening progress">
          <li className="step-done"><span>1</span>Breach captured</li>
          <li className="step-active"><span>2</span>Signature synthesis</li>
          <li><span>3</span>Replay + fixture proof</li>
          <li><span>4</span>Install rule</li>
        </ol>
      </div>
    );
  }

  if (phase === "adapting") {
    return (
      <div className="run-status run-status-adapting" role="status" aria-live="polite">
        <span className="run-status-kicker">Round {activeRound?.round} held</span>
        <strong>Attacker is reading every denial and planning a smarter batch</strong>
        <p>Exact rule names and rejection reasons are being fed back into the next schemer call.</p>
      </div>
    );
  }

  if (phase === "ended" && finalSummary) {
    return (
      <div className={`run-status run-status-ended run-status-${finalWinner ?? "house"}`} role="status">
        <span className="run-status-kicker">
          {finalWinner === "schemer" ? "Breach found · defense hardened" : "Defense held all three rounds"}
        </span>
        <strong>{finalWinner === "schemer" ? "The attacker found a gap; Codex closed it." : "The house wins this heist."}</strong>
        <p>{finalSummary}</p>
      </div>
    );
  }

  if (phase === "round" && activeRound) {
    const resolved = activeRound.attempts.filter(({ verdict }) => verdict).length;
    return (
      <div className="run-status run-status-live" role="status" aria-live="polite">
        <span className="run-status-kicker">Live · round {activeRound.round} of 3</span>
        <strong>Attacker is generating and testing seven different evasion techniques</strong>
        <p>{activeRound.attempts.length} streamed · {resolved} independently evaluated</p>
      </div>
    );
  }

  if (running) {
    return (
      <div className="run-status run-status-live" role="status" aria-live="polite">
        <span className="run-status-kicker">Live model request</span>
        <strong>Calling the schemer for seven distinct attacks…</strong>
        <p>The first attack will appear immediately when its JSON object reaches the stream.</p>
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
        {rounds.map((round) => {
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

              {round.round > 1 ? (
                <p className="round-adaptation-note">
                  <strong>Attacker adapted:</strong> prior denial rules and reasons shaped these new strategies.
                </p>
              ) : null}
              <p className="round-taunt"><span>Schemer</span> “{round.taunt}”</p>

              <AnimatePresence initial={false}>
                {round.attempts.map(({ attempt, verdict, latencyMs }) => (
                  <EventRow
                    key={attempt.id}
                    attempt={attempt}
                    verdict={verdict}
                    latencyMs={latencyMs}
                  />
                ))}
              </AnimatePresence>

              {complete ? (
                <div className={`round-outcome ${breached ? "round-outcome-breach" : "round-outcome-held"}`}>
                  <strong>{breached ? "Breach found" : `All ${round.attempts.length} attacks blocked`}</strong>
                  <span>
                    {breached
                      ? "Codex immediately began synthesizing a rule for the successful signature."
                      : round.round < 3 && round.round === latestRound && phase !== "ended"
                        ? "The exact denials went back to the attacker for a smarter next round."
                        : round.round < 3
                          ? `Feedback produced the adapted round ${round.round + 1} batch below.`
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
            <p>
              You will see each attack arrive, each defense decision resolve, every adaptive round,
              and any new deterministic rule Codex installs.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
