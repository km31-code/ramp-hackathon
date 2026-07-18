"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  MAX_ROUNDS,
  type Attempt,
  type HeistEvent,
  type PolicyUpdate,
  type Verdict,
} from "@/lib/contracts/heist";
import { streamHeist } from "@/lib/contracts/stream";
import { fallbackHeist } from "@/lib/mock";

import { AttackMemory } from "./attack-memory";
import { DocsPanel } from "./docs-panel";
import { HardenPanel } from "./harden-panel";
import { HeroCommand } from "./hero-command";
import {
  getPolicySnapshot,
  getServerPolicySnapshot,
  subscribePolicy,
  upsertPolicyUpdate,
} from "./memory-store";
import { SessionLog, type SessionPhase, type SessionRound } from "./session-log";
import { SessionStats } from "./session-stats";
import { TopNav, type AppView } from "./top-nav";

interface AttemptState {
  attempt: Attempt;
  verdict?: Verdict;
}

function createRunId(): string {
  return `run_${Math.random().toString(36).slice(2, 7)}`;
}

export function HeistConsole() {
  const [input, setInput] = useState("get me a PS5 on the company card");
  const [view, setView] = useState<AppView>("console");
  const [events, setEvents] = useState<HeistEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState("run_idle");
  const [activeWish, setActiveWish] = useState("get me a PS5 on the company card");
  const installedUpdates = useSyncExternalStore(
    subscribePolicy,
    getPolicySnapshot,
    getServerPolicySnapshot,
  );
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

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
        .map(({ attempt }) => ({
          attempt,
          verdict: verdicts.get(attempt.id),
        })),
    [events, verdicts],
  );

  const rounds = useMemo<SessionRound[]>(() => {
    const roundEnds = new Map<number, Extract<HeistEvent, { type: "round_end" }>>();
    for (const event of events) {
      if (event.type === "round_end") roundEnds.set(event.round, event);
    }

    return events
      .filter((event): event is Extract<HeistEvent, { type: "round" }> => event.type === "round")
      .map((event) => ({
        round: event.round,
        taunt: event.taunt,
        attempts: allAttempts.filter(({ attempt }) => attempt.round === event.round),
        allBlocked: roundEnds.get(event.round)?.allBlocked,
        policyUpdate: roundEnds.get(event.round)?.policyUpdate,
      }));
  }, [events, allAttempts]);

  const finalEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "end" }> => event.type === "end");
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

  const heldCount = allAttempts.filter(({ verdict }) => verdict?.decision === "BLOCKED").length;
  const breachCount = allAttempts.filter(({ verdict }) => verdict?.decision === "APPROVED").length;
  const hasApprovedPending =
    currentRound !== undefined &&
    allAttempts.some(
      ({ attempt, verdict }) =>
        attempt.round === currentRound && verdict?.decision === "APPROVED",
    ) &&
    !events.some(
      (event) =>
        event.type === "round_end" &&
        event.round === currentRound &&
        event.policyUpdate !== undefined,
    ) &&
    !finalEvent;
  const roundEndIndex = lastRoundEnd ? events.lastIndexOf(lastRoundEnd) : -1;
  const hasEventAfterRoundEnd =
    roundEndIndex >= 0 &&
    events
      .slice(roundEndIndex + 1)
      .some((event) => event.type === "round" || event.type === "end");

  const phase: SessionPhase = errorEvent
    ? "error"
    : finalEvent
      ? "ended"
      : hasApprovedPending
        ? "hardening"
        : lastRoundEnd && lastRoundEnd.round < MAX_ROUNDS && !hasEventAfterRoundEnd
          ? "adapting"
          : currentRound
            ? "round"
            : "idle";

  const statusLabel =
    phase === "error"
      ? "Live run error"
      : phase === "hardening"
        ? "Codex hardening breach"
        : phase === "adapting"
          ? lastRoundEnd?.policyUpdate
            ? "Policy hardened · next round"
            : "Attacker adapting"
          : running
            ? `Live round ${currentRound ?? 1}`
            : finalEvent
              ? "Run complete"
              : "Ready for a wish";

  function flashRule(ruleId: string) {
    setHighlightedRuleId(ruleId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedRuleId(null), 1_400);
  }

  function recordEvent(event: HeistEvent) {
    if (event.type === "start") setActiveWish(event.wish);
    setEvents((current) => [...current, event]);
    if (event.type === "round_end" && event.policyUpdate) {
      upsertPolicyUpdate(event.policyUpdate);
      flashRule(event.policyUpdate.rule.id);
    }
    if (event.type === "end" || event.type === "error") setRunning(false);
  }

  async function runLive(nextWish: string) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setRunId(createRunId());
    setActiveWish(nextWish);
    setEvents([]);
    setHighlightedRuleId(null);
    setInput("");
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
    setRunId(createRunId());
    setActiveWish(fallbackWish);
    setEvents([]);
    setHighlightedRuleId(null);
    setInput("");
    setRunning(true);

    for await (const event of fallbackHeist(fallbackWish, 90)) recordEvent(event);
  }

  const sourceAttempt = latestPolicyUpdate
    ? allAttempts.find(({ attempt }) => attempt.id === latestPolicyUpdate.sourceAttemptId)?.attempt
    : undefined;

  return (
    <div className="patchline">
      <TopNav view={view} onViewChange={setView} />

      {view === "docs" ? <DocsPanel /> : null}

      {view === "console" ? (
        <>
          <HeroCommand
            input={input}
            running={running}
            targetWish={activeWish}
            statusLabel={statusLabel}
            onInputChange={setInput}
            onSubmit={(wish) => void runLive(wish)}
            onFallback={() => void runFallback()}
          />

          <div className="workspace">
            <SessionLog
              runId={runId}
              statusLabel={statusLabel}
              rounds={rounds}
              phase={phase}
              running={running}
              errorMessage={errorEvent?.message}
              finalSummary={finalEvent?.summary}
              finalWinner={finalEvent?.winner}
            />

            <div className="side-rail">
              <AttackMemory
                entries={installedUpdates}
                highlightedId={highlightedRuleId}
              />
              <SessionStats
                rounds={rounds.length}
                attempts={allAttempts.length}
                held={heldCount}
                breaches={breachCount}
                hardened={installedUpdates.length}
              />
              {latestPolicyUpdate ? (
                <HardenPanel
                  update={latestPolicyUpdate}
                  sourceAttempt={sourceAttempt}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
