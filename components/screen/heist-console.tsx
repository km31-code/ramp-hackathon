"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type {
  Attempt,
  HeistEvent,
  MemoryEntry,
  Scorecard,
  Verdict,
} from "@/lib/contracts/heist";
import { streamHeist } from "@/lib/contracts/stream";
import { mockHeist } from "@/lib/mock";

import { AttackMemory } from "./attack-memory";
import { AttemptCard } from "./attempt-card";
import { FinalePanel } from "./finale-panel";
import {
  getMemorySnapshot,
  getServerMemorySnapshot,
  readSessionMemory,
  subscribeMemory,
  upsertSessionMemory,
} from "./memory-store";
import { RoundRail } from "./round-rail";
import { WishBar } from "./wish-bar";

type Phase = "idle" | "round" | "adapting" | "finale" | "ended" | "error";

type PatternCard = {
  patternId: string;
  attempt: Attempt;
  verdict?: Verdict;
  restampKey: string;
};

function roundSubtitle(round: number, hasPriorMemory: boolean): string {
  if (round === 1) {
    return hasPriorMemory ? "Prior patterns still loaded" : "Defense has no memory";
  }
  if (round === 2) return "Replaying with memory";
  return "Making it permanent";
}

export function HeistConsole() {
  const [input, setInput] = useState("get me a PS5 on the company card");
  const [wish, setWish] = useState("waiting for a target");
  const [events, setEvents] = useState<HeistEvent[]>([]);
  const [running, setRunning] = useState(false);
  const persistedMemory = useSyncExternalStore(
    subscribeMemory,
    getMemorySnapshot,
    getServerMemorySnapshot,
  );
  const [highlightedMemoryId, setHighlightedMemoryId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const memoryEntries = useMemo(() => {
    const byPattern = new Map<string, MemoryEntry>();
    for (const entry of persistedMemory) byPattern.set(entry.patternId, entry);
    for (const event of events) {
      if (event.type === "memory") byPattern.set(event.entry.patternId, event.entry);
    }
    return [...byPattern.values()];
  }, [persistedMemory, events]);

  const hasPriorMemory = persistedMemory.length > 0;

  const patternCards = useMemo(() => {
    const verdicts = new Map<string, Verdict>();
    for (const event of events) {
      if (event.type === "verdict") verdicts.set(event.verdict.attemptId, event.verdict);
    }

    const byPattern = new Map<string, PatternCard>();
    for (const event of events) {
      if (event.type !== "attempt") continue;
      const { attempt } = event;
      const verdict = verdicts.get(attempt.id);
      byPattern.set(attempt.patternId, {
        patternId: attempt.patternId,
        attempt,
        verdict,
        restampKey: verdict
          ? `${attempt.patternId}-${verdict.decision}-${attempt.round}`
          : `${attempt.patternId}-pending-${attempt.round}`,
      });
    }
    return [...byPattern.values()];
  }, [events]);

  const currentRound = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "round" }> => event.type === "round")
    ?.round;

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

  const patchEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "patch" }> => event.type === "patch");

  const prEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "pr" }> => event.type === "pr");

  const persistEvent = [...events]
    .reverse()
    .find((event): event is Extract<HeistEvent, { type: "persist" }> => event.type === "persist");

  const phase: Phase = useMemo(() => {
    if (errorEvent) return "error";
    if (finalEvent) return "ended";
    if (patchEvent || prEvent || persistEvent) return "finale";
    if (!events.length) return "idle";

    if (lastRoundEnd) {
      const lastRoundEndIndex = events.lastIndexOf(lastRoundEnd);
      const later = events
        .slice(lastRoundEndIndex + 1)
        .some(
          (event) =>
            event.type === "round" ||
            event.type === "end" ||
            event.type === "patch" ||
            event.type === "pr" ||
            event.type === "persist",
        );
      if (!later) return "adapting";
    }

    if (currentRound) return "round";
    return "idle";
  }, [
    events,
    errorEvent,
    finalEvent,
    lastRoundEnd,
    currentRound,
    patchEvent,
    prEvent,
    persistEvent,
  ]);

  const feedLabel =
    phase === "adapting"
      ? "Learning"
      : phase === "finale"
        ? "Shipping fix"
        : running
          ? "Live feed"
          : finalEvent
            ? "Complete"
            : "Armed";

  const activeSubtitle = currentRound
    ? roundSubtitle(currentRound, hasPriorMemory || memoryEntries.length > 0)
    : undefined;

  function flashMemory(memoryId: string) {
    setHighlightedMemoryId(memoryId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMemoryId(null), 1200);
  }

  function recordEvent(event: HeistEvent) {
    setEvents((current) => [...current, event]);

    if (event.type === "memory") {
      upsertSessionMemory(event.entry);
    }

    if (event.type === "start") setWish(event.wish);
    if (event.type === "memory_hit") flashMemory(event.memoryId);
    if (event.type === "end" || event.type === "error") setRunning(false);
  }

  function knownIdsForRun(): string[] {
    return readSessionMemory().map((entry) => entry.patternId);
  }

  async function runLive(nextWish: string) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setEvents([]);
    setHighlightedMemoryId(null);
    setInput("");
    setRunning(true);

    const known = knownIdsForRun();

    try {
      await streamHeist(
        { wish: nextWish, knownPatternIds: known },
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
    setEvents([]);
    setHighlightedMemoryId(null);
    setInput("");
    setRunning(true);

    const known = knownIdsForRun();
    const knownEntries = readSessionMemory();

    for await (const event of mockHeist(fallbackWish, 700, {
      knownPatternIds: known,
      knownEntries,
    })) {
      recordEvent(event);
    }
  }

  const scorecard: Scorecard | undefined = finalEvent?.scorecard;
  const showFinale = Boolean(patchEvent || prEvent || scorecard);

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
            phase === "finale" || phase === "ended"
              ? "ended"
              : phase === "adapting"
                ? "adapting"
                : phase === "error"
                  ? "error"
                  : phase === "idle"
                    ? "idle"
                    : "round"
          }
          subtitle={activeSubtitle}
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

          {activeSubtitle ? <p className="round-subtitle">{activeSubtitle}</p> : null}

          {phase === "round" && taunt ? <p className="taunt">{taunt}</p> : null}
          {errorEvent ? (
            <p className="stream-error" role="alert">
              {errorEvent.message}
            </p>
          ) : null}

          {phase === "adapting" && lastRoundEnd ? (
            <div className="adaptation-beat" role="status">
              <p className="adaptation-eyebrow">
                {lastRoundEnd.round === 1
                  ? lastRoundEnd.allBlocked
                    ? "Memory held — nothing new to learn"
                    : "Breaches stored — memory updated"
                  : lastRoundEnd.round === 2
                    ? "Memory held — locking the fix"
                    : "Round complete"}
              </p>
              <h2 className="adaptation-title">
                {lastRoundEnd.round === 1
                  ? lastRoundEnd.allBlocked
                    ? "Prior knowledge was enough"
                    : "Learning from what got through"
                  : "Preparing permanence"}
              </h2>
            </div>
          ) : null}

          <div className="attempt-list" aria-live="polite">
            <AnimatePresence initial={false}>
              {phase !== "adapting"
                ? patternCards.map((card) => (
                    <AttemptCard
                      key={card.patternId}
                      attempt={card.attempt}
                      verdict={card.verdict}
                      restampKey={card.restampKey}
                    />
                  ))
                : null}
            </AnimatePresence>

            {phase === "idle" && !patternCards.length ? (
              <div className="empty-state">
                <p className="empty-title">Make a wish.</p>
                <p className="empty-copy">
                  {hasPriorMemory
                    ? "Attack Memory is still loaded from prior wishes. Known tricks get blocked immediately."
                    : "Attacks get through, memory fills, then the defense patches itself."}
                </p>
              </div>
            ) : null}

            {showFinale ? (
              <FinalePanel
                patch={
                  patchEvent
                    ? {
                        title: patchEvent.title,
                        filename: patchEvent.filename,
                        diff: patchEvent.diff,
                      }
                    : undefined
                }
                pr={
                  prEvent
                    ? {
                        status: prEvent.status,
                        title: prEvent.title,
                        url: prEvent.url,
                        body: prEvent.body,
                      }
                    : undefined
                }
                persistCount={persistEvent?.count}
                scorecard={scorecard}
                summary={finalEvent?.summary}
              />
            ) : null}
          </div>
        </section>

        <div className="side-rail">
          <AttackMemory entries={memoryEntries} highlightedId={highlightedMemoryId} />
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
