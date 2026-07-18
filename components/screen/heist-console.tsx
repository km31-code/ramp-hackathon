"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { Attempt, HeistEvent, PolicyUpdate, Verdict } from "@/lib/contracts/heist";
import { streamHeist } from "@/lib/contracts/stream";
import { fallbackHeist } from "@/lib/mock";

import { AdaptationBeat } from "./adaptation-beat";
import { AttackMemory } from "./attack-memory";
import { AttemptCard } from "./attempt-card";
import { FinalePanel } from "./finale-panel";
import {
  pushLeaderboardEntry,
  readLeaderboard,
  type LeaderboardEntry,
} from "./leaderboard";
import {
  getPolicySnapshot,
  getServerPolicySnapshot,
  subscribePolicy,
  upsertPolicyUpdate,
} from "./memory-store";
import { PolicyRail } from "./policy-rail";
import { RoundRail } from "./round-rail";
import { WishBar } from "./wish-bar";

type Phase = "idle" | "round" | "adapting" | "hardening" | "ended" | "error";

interface AttemptState {
  attempt: Attempt;
  verdict?: Verdict;
}

function roundSubtitle(round: number): string {
  if (round === 1) return "Seven distinct attack surfaces, streamed live";
  if (round === 2) return "Schemer adapting to every prior denial";
  return "Final adaptive round";
}

export function HeistConsole() {
  const [input, setInput] = useState("get me a PS5 on the company card");
  const [wish, setWish] = useState("waiting for a target");
  const [events, setEvents] = useState<HeistEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const installedUpdates = useSyncExternalStore(
    subscribePolicy,
    getPolicySnapshot,
    getServerPolicySnapshot,
  );
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWishRef = useRef(input);
  const currentRoundRef = useRef(1);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLeaderboard(readLeaderboard()));
    return () => {
      cancelAnimationFrame(frame);
      abortRef.current?.abort();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const currentRound = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "round" }> => event.type === "round")
    ?.round;

  const verdicts = useMemo(() => {
    const byAttempt = new Map<string, Verdict>();
    for (const event of events) {
      if (event.type === "verdict") byAttempt.set(event.verdict.attemptId, event.verdict);
    }
    return byAttempt;
  }, [events]);

  const allAttempts = useMemo<AttemptState[]>(
    () =>
      events
        .filter((event): event is Extract<HeistEvent, { type: "attempt" }> => event.type === "attempt")
        .map(({ attempt }) => ({ attempt, verdict: verdicts.get(attempt.id) })),
    [events, verdicts],
  );

  const visibleAttempts = currentRound
    ? allAttempts.filter(({ attempt }) => attempt.round === currentRound)
    : [];

  const finalEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "end" }> => event.type === "end");
  const taunt = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "round" }> => event.type === "round")
    ?.taunt;
  const errorEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "error" }> => event.type === "error");
  const lastRoundEnd = [...events]
    .reverse()
    .find(
      (event): event is Extract<HeistEvent, { type: "round_end" }> => event.type === "round_end",
    );
  const latestPolicyUpdate = [...events]
    .reverse()
    .find(
      (
        event,
      ): event is Extract<HeistEvent, { type: "round_end" }> & {
        policyUpdate: PolicyUpdate;
      } => event.type === "round_end" && event.policyUpdate !== undefined,
    )?.policyUpdate;

  const approvedCount = allAttempts.filter(({ verdict }) => verdict?.decision === "APPROVED").length;
  const blockedCount = allAttempts.filter(({ verdict }) => verdict?.decision === "BLOCKED").length;
  const hasApprovedPending = approvedCount > 0 && !latestPolicyUpdate && !finalEvent;
  const roundEndIndex = lastRoundEnd ? events.lastIndexOf(lastRoundEnd) : -1;
  const hasEventAfterRoundEnd =
    roundEndIndex >= 0 &&
    events.slice(roundEndIndex + 1).some((event) => event.type === "round" || event.type === "end");

  const phase: Phase = errorEvent
    ? "error"
    : finalEvent
      ? "ended"
      : hasApprovedPending || (lastRoundEnd?.policyUpdate && !hasEventAfterRoundEnd)
        ? "hardening"
        : lastRoundEnd?.allBlocked && !hasEventAfterRoundEnd
          ? "adapting"
          : currentRound
            ? "round"
            : "idle";

  const learnedRules = lastRoundEnd
    ? [...new Set(
        allAttempts
          .filter(({ attempt, verdict }) => attempt.round === lastRoundEnd.round && verdict)
          .map(({ verdict }) => verdict?.rule)
          .filter((rule): rule is string => Boolean(rule)),
      )]
    : [];

  const feedLabel =
    phase === "adapting"
      ? "Schemer adapting"
      : phase === "hardening"
        ? "Compiling policy"
        : running
          ? "Live feed"
          : finalEvent
            ? "Complete"
            : "Armed";

  function flashRule(ruleId: string) {
    setHighlightedRuleId(ruleId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedRuleId(null), 1_400);
  }

  function recordEvent(event: HeistEvent) {
    setEvents((current) => [...current, event]);
    if (event.type === "start") {
      setWish(event.wish);
      activeWishRef.current = event.wish;
    }
    if (event.type === "round") currentRoundRef.current = event.round;
    if (event.type === "round_end" && event.policyUpdate) {
      upsertPolicyUpdate(event.policyUpdate);
      flashRule(event.policyUpdate.rule.id);
    }
    if (event.type === "end") {
      setLeaderboard(
        pushLeaderboardEntry({
          wish: activeWishRef.current,
          outcome: event.winner === "schemer" ? "breached" : "held",
          round: currentRoundRef.current,
        }),
      );
      setRunning(false);
    }
    if (event.type === "error") setRunning(false);
  }

  async function runLive(nextWish: string) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    activeWishRef.current = nextWish;
    currentRoundRef.current = 1;
    setLeaderboard(readLeaderboard());
    setEvents([]);
    setHighlightedRuleId(null);
    setRunning(true);

    try {
      await streamHeist(
        { wish: nextWish },
        { signal: controller.signal, onEvent: recordEvent },
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      recordEvent({
        type: "error",
        message: error instanceof Error ? error.message : "The stream failed.",
      });
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }

  async function runFallback() {
    abortRef.current?.abort();
    abortRef.current = null;
    const fallbackWish = input.trim() || "get me a PS5 on the company card";
    activeWishRef.current = fallbackWish;
    currentRoundRef.current = 1;
    setLeaderboard(readLeaderboard());
    setEvents([]);
    setHighlightedRuleId(null);
    setRunning(true);

    for await (const event of fallbackHeist(fallbackWish, 90)) recordEvent(event);
  }

  return (
    <main className="cabinet">
      <div className="cabinet-glow" aria-hidden="true" />

      <header className="masthead">
        <div>
          <p className="eyebrow">Corporate spend defense</p>
          <h1>Expense Heist</h1>
        </div>
        <RoundRail
          currentRound={currentRound}
          phase={
            phase === "ended"
              ? "ended"
              : phase === "adapting" || phase === "hardening"
                ? "adapting"
                : phase
          }
          subtitle={currentRound ? roundSubtitle(currentRound) : undefined}
        />
      </header>

      <section className="wish-line" aria-live="polite">
        <span>The wish</span>
        <strong>“{wish}”</strong>
      </section>

      <div className="game-grid">
        <section className="attempts-panel" aria-label="Heist attempts">
          <div className="section-heading">
            <h2>{currentRound ? `Round ${currentRound}` : "Attempts"}</h2>
            <span>{feedLabel}</span>
          </div>

          {currentRound ? <p className="round-subtitle">{roundSubtitle(currentRound)}</p> : null}
          {phase !== "adapting" && taunt ? <p className="taunt">“{taunt}”</p> : null}
          {errorEvent ? <p className="stream-error" role="alert">{errorEvent.message}</p> : null}

          {phase === "adapting" && lastRoundEnd ? (
            <AdaptationBeat fromRound={lastRoundEnd.round} learnedRules={learnedRules} />
          ) : null}

          {phase === "hardening" ? (
            <div className="adaptation-beat hardening-beat" role="status" aria-live="polite">
              <p className="adaptation-eyebrow">Breach found — synthesizer active</p>
              <h2 className="adaptation-title">Compiling a narrow deterministic signature</h2>
              <ul className="learned-chips">
                <li>Replay the breach</li>
                <li>Test legitimate fixtures</li>
                <li>Reject broad rules</li>
              </ul>
              <p className="adaptation-taunt adaptation-taunt-pending">
                The policy updates only after every proof passes.
              </p>
            </div>
          ) : null}

          <div className="attempt-list" aria-live="polite">
            <AnimatePresence initial={false}>
              {phase !== "adapting"
                ? visibleAttempts.map(({ attempt, verdict }) => (
                    <AttemptCard
                      key={attempt.id}
                      attempt={attempt}
                      verdict={verdict}
                      restampKey={verdict ? `${attempt.id}-${verdict.decision}` : attempt.id}
                    />
                  ))
                : null}
            </AnimatePresence>

            {phase === "idle" && !visibleAttempts.length ? (
              <div className="empty-state">
                <p className="empty-title">Make a wish.</p>
                <p className="empty-copy">
                  Seven distinct schemes race through rules, semantic review, and policy hardening.
                </p>
              </div>
            ) : null}

            {finalEvent ? (
              <FinalePanel
                update={latestPolicyUpdate}
                winner={finalEvent.winner}
                summary={finalEvent.summary}
                attempts={allAttempts.length}
                blocked={blockedCount}
                approved={approvedCount}
              />
            ) : null}
          </div>
        </section>

        <div className="side-rail">
          <AttackMemory entries={installedUpdates} highlightedId={highlightedRuleId} />
          <PolicyRail
            finalWinner={finalEvent?.winner}
            finalSummary={finalEvent?.summary}
            leaderboard={leaderboard}
          />
        </div>
      </div>

      <WishBar
        input={input}
        running={running}
        onInputChange={setInput}
        onSubmit={(nextWish) => void runLive(nextWish)}
        onFallback={() => void runFallback()}
      />
    </main>
  );
}
