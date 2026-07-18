"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Attempt, HeistEvent, Verdict } from "@/lib/contracts/heist";
import { MAX_ROUNDS, MAX_WISH_LENGTH } from "@/lib/contracts/heist";
import { POLICY } from "@/lib/contracts/policy";
import { streamHeist } from "@/lib/contracts/stream";
import { fallbackHeist } from "@/lib/mock";

const PRESETS = ["hot tub for the offsite", "PS5", "Vegas flight", "400 energy drinks"];

interface AttemptState {
  attempt: Attempt;
  verdict?: Verdict;
}

export function HeistConsole() {
  const [input, setInput] = useState("get me a PS5 on the company card");
  const [wish, setWish] = useState("waiting for a target");
  const [events, setEvents] = useState<HeistEvent[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const attempts = useMemo<AttemptState[]>(() => {
    const verdicts = new Map<string, Verdict>();

    for (const event of events) {
      if (event.type === "verdict") verdicts.set(event.verdict.attemptId, event.verdict);
    }

    return events
      .filter((event): event is Extract<HeistEvent, { type: "attempt" }> => event.type === "attempt")
      .map(({ attempt }) => ({ attempt, verdict: verdicts.get(attempt.id) }));
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
  const policyUpdate = [...events]
    .reverse()
    .find(
      (event): event is Extract<HeistEvent, { type: "round_end" }> =>
        event.type === "round_end" && event.policyUpdate !== undefined,
    )?.policyUpdate;
  const breachPending = attempts.some(({ verdict }) => verdict?.decision === "APPROVED") && !policyUpdate;

  function recordEvent(event: HeistEvent) {
    setEvents((current) => [...current, event]);
    if (event.type === "start") setWish(event.wish);
    if (event.type === "end" || event.type === "error") setRunning(false);
  }

  async function runLive(nextWish: string) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setEvents([]);
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
    setEvents([]);
    setRunning(true);

    for await (const event of fallbackHeist(input.trim() || undefined, 90)) {
      recordEvent(event);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextWish = input.trim();
    if (!nextWish || running) return;
    void runLive(nextWish);
  }

  return (
    <main className="cabinet">
      <header className="masthead">
        <div>
          <p className="eyebrow">Corporate spend defense terminal</p>
          <h1>Expense Heist</h1>
        </div>
        <div className="round-counter">
          Round <strong>{currentRound ?? "–"}</strong> / {MAX_ROUNDS}
        </div>
      </header>

      <section className="wish-line" aria-live="polite">
        <span>The wish</span>
        <strong>“{wish}”</strong>
      </section>

      <div className="game-grid">
        <section className="attempts-panel" aria-label="Heist attempts">
          <div className="section-heading">
            <h2>Attempts</h2>
            <span>{running ? "Live feed" : finalEvent ? "Complete" : "Armed"}</span>
          </div>

          {taunt ? <p className="taunt">&gt; {taunt}</p> : null}
          {errorEvent ? <p className="stream-error" role="alert">{errorEvent.message}</p> : null}

          <div className="attempt-list" aria-live="polite">
            <AnimatePresence initial={false}>
              {attempts.map(({ attempt, verdict }) => (
                <motion.article
                  className="attempt-card"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={attempt.id}
                  layout
                >
                  <div className="attempt-topline">
                    <h3>{attempt.strategy}</h3>
                    {verdict ? (
                      <motion.span
                        className={`stamp stamp-${verdict.decision.toLowerCase()}`}
                        initial={{ opacity: 0, rotate: -8, scale: 1.45 }}
                        animate={{ opacity: 1, rotate: -2, scale: 1 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {verdict.decision}
                      </motion.span>
                    ) : (
                      <span className="pending">Evaluating</span>
                    )}
                  </div>
                  <p className="ledger-line">
                    {attempt.count > 1 ? `${attempt.count} × ` : ""}${formatMoney(attempt.amount)} · {attempt.vendor}
                  </p>
                  <p className="narration">“{attempt.narration}”</p>
                  {verdict ? (
                    <p className="verdict-reason">
                      <span>{verdict.layer}</span> {verdict.reason}
                    </p>
                  ) : null}
                </motion.article>
              ))}
            </AnimatePresence>

            {!attempts.length ? (
              <div className="empty-state">Enter a wish. The schemer will try every angle.</div>
            ) : null}
          </div>
        </section>

        <aside className="policy-panel">
          <div className="section-heading">
            <h2>Policy</h2>
            <span>Two-layer defense</span>
          </div>
          <dl className="policy-list">
            <div><dt>Single charge</dt><dd>{formatMoney(POLICY.SINGLE_TXN_LIMIT)}</dd></div>
            <div><dt>Round total</dt><dd>{formatMoney(POLICY.ROUND_TOTAL_LIMIT)}</dd></div>
            <div><dt>Blocked categories</dt><dd>{POLICY.BLOCKED_CATEGORIES.length}</dd></div>
            <div><dt>Approved vendors</dt><dd>{POLICY.APPROVED_VENDORS.length}</dd></div>
          </dl>

          <div className="layer-explainer">
            <p><strong>01 / Rules</strong> instant, deterministic checks</p>
            <p><strong>02 / Reviewer</strong> pattern and intent across the round</p>
            <p><strong>03 / Synthesizer</strong> promotes a breach into executable policy</p>
          </div>

          {breachPending ? (
            <div className="hardening-state" aria-live="polite">
              <span>Hardening policy…</span>
              <p>Compiling a narrow signature and regression-testing legitimate purchases.</p>
            </div>
          ) : null}

          {policyUpdate ? (
            <motion.div
              className="policy-update"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>New rule installed</span>
              <h3>{policyUpdate.rule.name}</h3>
              <code>{policyUpdate.rule.id}</code>
              <p>{policyUpdate.rule.reason}</p>
              <small>
                Replay blocked · {policyUpdate.validation.legitimateFixturesTested} legitimate fixtures · 0 false positives
              </small>
            </motion.div>
          ) : null}

          {finalEvent ? (
            <motion.div
              className={`final-state final-${finalEvent.winner}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span>{finalEvent.winner === "house" ? "Policy held" : "Policy breached"}</span>
              <p>{finalEvent.summary}</p>
            </motion.div>
          ) : null}
        </aside>
      </div>

      <footer className="control-deck">
        <form onSubmit={handleSubmit}>
          <label htmlFor="wish">Make a wish</label>
          <div className="input-row">
            <input
              id="wish"
              maxLength={MAX_WISH_LENGTH}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'try me — "get me a PS5 on the company card"'}
              value={input}
              disabled={running}
            />
            <button type="submit" disabled={running || !input.trim()}>
              {running ? "Running…" : "Go"}
            </button>
          </div>
        </form>
        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button key={preset} onClick={() => setInput(preset)} disabled={running} type="button">
              {preset}
            </button>
          ))}
          <button className="fallback-button" onClick={() => void runFallback()} disabled={running} type="button">
            Demo fallback
          </button>
        </div>
      </footer>
    </main>
  );
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
