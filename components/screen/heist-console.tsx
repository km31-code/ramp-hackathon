"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { Attempt, HeistEvent, PolicyUpdate, Verdict } from "@/lib/contracts/heist";
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
import { SessionLog } from "./session-log";
import { SessionStats } from "./session-stats";
import { StyleGuide } from "./style-guide";
import { TopNav, type AppView } from "./top-nav";

type Phase = "idle" | "round" | "adapting" | "hardening" | "ended" | "error";

interface AttemptState {
  attempt: Attempt;
  verdict?: Verdict;
  latencyMs?: number;
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
  const [probeCount, setProbeCount] = useState(0);
  const [patches, setPatches] = useState(0);
  const installedUpdates = useSyncExternalStore(
    subscribePolicy,
    getPolicySnapshot,
    getServerPolicySnapshot,
  );
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptStartedAt = useRef<Map<string, number>>(new Map());
  const [latencies, setLatencies] = useState<Record<string, number>>({});

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
          latencyMs: latencies[attempt.id],
        })),
    [events, verdicts, latencies],
  );

  const visibleAttempts = currentRound
    ? allAttempts.filter(({ attempt }) => attempt.round === currentRound)
    : allAttempts;

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
  const hasApprovedPending = breachCount > 0 && !latestPolicyUpdate && !finalEvent;
  const roundEndIndex = lastRoundEnd ? events.lastIndexOf(lastRoundEnd) : -1;
  const hasEventAfterRoundEnd =
    roundEndIndex >= 0 &&
    events
      .slice(roundEndIndex + 1)
      .some((event) => event.type === "round" || event.type === "end");

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

  const statusLabel =
    phase === "hardening"
      ? "Hardening"
      : phase === "adapting"
        ? "Learning"
        : running
          ? "Running"
          : finalEvent
            ? "Complete"
            : "Idle";

  const coverage = installedUpdates.length;

  function flashRule(ruleId: string) {
    setHighlightedRuleId(ruleId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedRuleId(null), 1_400);
  }

  function recordEvent(event: HeistEvent) {
    if (event.type === "attempt") {
      attemptStartedAt.current.set(event.attempt.id, Date.now());
    }
    if (event.type === "verdict") {
      const started = attemptStartedAt.current.get(event.verdict.attemptId);
      if (started) {
        const latencyMs = Math.max(40, Date.now() - started);
        setLatencies((current) => ({
          ...current,
          [event.verdict.attemptId]: latencyMs,
        }));
      }
    }
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
    attemptStartedAt.current = new Map();
    setLatencies({});
    setRunId(createRunId());
    setProbeCount((count) => count + 1);
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
    attemptStartedAt.current = new Map();
    setLatencies({});
    setRunId(createRunId());
    setProbeCount((count) => count + 1);
    setEvents([]);
    setHighlightedRuleId(null);
    setInput("");
    setRunning(true);

    for await (const event of fallbackHeist(fallbackWish, 90)) recordEvent(event);
  }

  const showHarden = Boolean(latestPolicyUpdate && (phase === "hardening" || phase === "ended"));

  return (
    <div className="patchline">
      <TopNav view={view} onViewChange={setView} />

      {view === "docs" ? <DocsPanel /> : null}
      {view === "styles" ? <StyleGuide /> : null}

      {view === "console" ? (
        <>
          <HeroCommand
            input={input}
            running={running}
            onInputChange={setInput}
            onSubmit={(wish) => void runLive(wish)}
            onFallback={() => void runFallback()}
          />

          <div className="workspace">
            <SessionLog
              runId={runId}
              statusLabel={statusLabel}
              attempts={visibleAttempts}
              errorMessage={errorEvent?.message}
              hardening={phase === "hardening"}
            />

            <div className="side-rail">
              <AttackMemory
                entries={installedUpdates}
                highlightedId={highlightedRuleId}
                runId={runId}
              />
              <SessionStats
                probes={probeCount}
                held={heldCount}
                coverage={coverage}
                patches={patches}
              />
              {showHarden ? (
                <HardenPanel
                  update={latestPolicyUpdate}
                  runId={runId}
                  onPatched={() => setPatches((count) => count + 1)}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
