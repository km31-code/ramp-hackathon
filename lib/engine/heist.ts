import { randomUUID } from "node:crypto";

import { MAX_ROUNDS } from "@/lib/contracts/heist";
import type { Attempt, HeistEvent, PolicyUpdate, Verdict } from "@/lib/contracts/heist";
import { calibrationForHeist } from "@/lib/engine/calibration";
import { HeistEngineError } from "@/lib/engine/errors";
import { logHeist } from "@/lib/engine/log";
import { InMemoryPolicyStore, policyStore } from "@/lib/engine/policy-store";
import { validateRuleCandidate } from "@/lib/engine/rule-synthesis";
import { evaluate } from "@/lib/engine/rules";
import type {
  DenialFeedback,
  GeneratedRound,
  GeneratedRoundChunk,
  HeistModel,
  ReviewAttemptInput,
} from "@/lib/engine/types";
import { expectedAttemptCount, sanitizeWish } from "@/lib/engine/validation";

export const HEIST_TIME_BUDGET_MS = 90_000;
export const REVIEWER_CONCURRENCY = 3;
export const SYNTHESIS_ATTEMPTS = 2;

interface RunHeistOptions {
  model: HeistModel;
  signal?: AbortSignal;
  timeBudgetMs?: number;
  reviewerConcurrency?: number;
  store?: InMemoryPolicyStore;
  createHeistId?: () => string;
  now?: () => number;
}

interface SettledVerdict {
  kind: "verdict";
  promise: Promise<SettledVerdict>;
  expectedAttemptId: string;
  verdict?: Verdict;
  error?: unknown;
}

interface NextChunk {
  kind: "chunk";
  result: IteratorResult<GeneratedRoundChunk, GeneratedRound>;
}

export async function* runHeist(
  untrustedWish: string,
  options: RunHeistOptions,
): AsyncGenerator<HeistEvent> {
  const wish = sanitizeWish(untrustedWish);
  const now = options.now ?? Date.now;
  const timeBudgetMs = options.timeBudgetMs ?? HEIST_TIME_BUDGET_MS;
  const concurrency = options.reviewerConcurrency ?? REVIEWER_CONCURRENCY;
  const heistId = (options.createHeistId ?? randomUUID)();
  const deadlineAt = now() + timeBudgetMs;
  const store = options.store ?? policyStore;
  let activeRules = store.snapshot();
  const calibration = calibrationForHeist(heistId, activeRules.length);
  const runController = new AbortController();
  const abortFromRequest = () => runController.abort(options.signal?.reason);

  if (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0) {
    throw new Error("timeBudgetMs must be positive.");
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("reviewerConcurrency must be a positive integer.");
  }
  if (options.signal?.aborted) abortFromRequest();
  options.signal?.addEventListener("abort", abortFromRequest, { once: true });

  let denialFeedback: DenialFeedback[] = [];
  let totalAttempts = 0;
  const hardenedBreaches: PolicyUpdate[] = [];

  try {
    logHeist({ heistId, event: "heist.start", rule: calibration });
    yield { type: "start", wish, heistId };

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      assertRunning(runController.signal, deadlineAt, now);
      const attempts: Attempt[] = [];
      const verdicts = new Map<string, Verdict>();
      const limitReview = createLimiter(concurrency);
      const pending = new Set<Promise<SettledVerdict>>();
      const iterator = options.model.streamRound({
        heistId,
        wish,
        round,
        denialFeedback,
        activeRules,
        deadlineAt,
        signal: runController.signal,
      });
      let nextChunk: Promise<NextChunk> | null = next(iterator);
      let generated: GeneratedRound | null = null;
      let roundEventSeen = false;

      while (nextChunk !== null || pending.size > 0) {
        assertRunning(runController.signal, deadlineAt, now);
        const result = await Promise.race([
          ...(nextChunk ? [nextChunk] : []),
          ...pending,
        ]);

        if (result.kind === "chunk") {
          if (result.result.done) {
            generated = result.result.value;
            nextChunk = null;
            continue;
          }

          const chunk = result.result.value;
          nextChunk = next(iterator);
          if (chunk.type === "round") {
            if (roundEventSeen || attempts.length > 0) invalidStream();
            roundEventSeen = true;
            yield { type: "round", round, taunt: chunk.taunt };
            continue;
          }

          if (!roundEventSeen) invalidStream();
          assertAttempt(chunk.attempt, round, attempts);
          const history = [...attempts];
          attempts.push(chunk.attempt);
          totalAttempts += 1;

          const rulesVerdict = evaluate(chunk.attempt, history, {
            wish,
            synthesizedRules: activeRules,
          });
          const verdictPromise = rulesVerdict
            ? Promise.resolve(rulesVerdict)
            : limitReview(() =>
                reviewWithFailClosed(options.model, {
                  heistId,
                  wish,
                  round,
                  attempt: chunk.attempt,
                  history,
                  calibration,
                  deadlineAt,
                  signal: runController.signal,
                }),
              );
          pending.add(settle(verdictPromise, chunk.attempt.id));
          if (rulesVerdict) {
            logHeist({
              heistId,
              event: "rules.blocked",
              round,
              attemptId: chunk.attempt.id,
              rule: rulesVerdict.rule,
              durationMs: 0,
            });
          }
          // Scheduling happens first, but this event is yielded before its verdict can be emitted.
          yield { type: "attempt", attempt: chunk.attempt };
          continue;
        }

        pending.delete(result.promise);
        if (result.error !== undefined) throw result.error;
        if (!result.verdict) throw new Error("Verdict task settled without a result.");
        if (
          result.verdict.attemptId !== result.expectedAttemptId ||
          verdicts.has(result.verdict.attemptId)
        ) {
          invalidStream();
        }
        verdicts.set(result.verdict.attemptId, result.verdict);
        yield { type: "verdict", verdict: result.verdict };
      }

      assertCompletedRound(generated, attempts, round);
      const orderedVerdicts = attempts.map((attempt) => {
        const verdict = verdicts.get(attempt.id);
        if (!verdict) invalidStream();
        return verdict;
      });
      const allBlocked = orderedVerdicts.every((verdict) => verdict.decision === "BLOCKED");

      if (!allBlocked) {
        const breachIndex = orderedVerdicts.findIndex((verdict) => verdict.decision === "APPROVED");
        const update = await synthesizeAndInstall({
          model: options.model,
          store,
          heistId,
          wish,
          round,
          attempt: attempts[breachIndex],
          history: attempts.slice(0, breachIndex),
          verdict: orderedVerdicts[breachIndex],
          deadlineAt,
          signal: runController.signal,
        });
        hardenedBreaches.push(update);
        activeRules = store.snapshot();
        yield { type: "round_end", round, allBlocked: false, policyUpdate: update };
        denialFeedback = attempts.map((attempt, index) => {
          const verdict = orderedVerdicts[index];
          return verdict.decision === "APPROVED"
            ? {
                strategy: attempt.strategy,
                rule: update.rule.id,
                reason: `This breach succeeded, then Codex installed ${update.rule.name}.`,
              }
            : {
                strategy: attempt.strategy,
                rule: verdict.rule,
                reason: verdict.reason,
              };
        });
        continue;
      }

      yield { type: "round_end", round, allBlocked: true };
      denialFeedback = attempts.map((attempt, index) => ({
        strategy: attempt.strategy,
        rule: orderedVerdicts[index].rule,
        reason: orderedVerdicts[index].reason,
      }));
    }

    if (hardenedBreaches.length > 0) {
      const ruleIds = hardenedBreaches.map((update) => update.rule.id).join(", ");
      const summary = `${totalAttempts} schemes tested across ${MAX_ROUNDS} rounds. ${hardenedBreaches.length} breach${hardenedBreaches.length === 1 ? " was" : "es were"} hardened (${ruleIds}), then the attacker tested the stronger policy.`;
      logHeist({
        heistId,
        event: "heist.complete",
        round: MAX_ROUNDS,
        winner: "schemer",
        rule: hardenedBreaches.at(-1)?.rule.id,
      });
      yield { type: "end", winner: "schemer", summary };
    } else {
      const summary = `${totalAttempts} adaptive schemes tested across ${MAX_ROUNDS} rounds. Every one was blocked.`;
      logHeist({ heistId, event: "heist.complete", round: MAX_ROUNDS, winner: "house" });
      yield { type: "end", winner: "house", summary };
    }
  } finally {
    options.signal?.removeEventListener("abort", abortFromRequest);
    runController.abort();
  }
}

async function reviewWithFailClosed(
  model: HeistModel,
  input: ReviewAttemptInput,
): Promise<Verdict> {
  try {
    return await model.reviewAttempt(input);
  } catch (error) {
    const recoverable =
      error instanceof HeistEngineError &&
      ["INVALID_MODEL_OUTPUT", "MODEL_RATE_LIMIT", "MODEL_TIMEOUT", "MODEL_UNAVAILABLE"].includes(
        error.code,
      );
    if (!recoverable) throw error;

    logHeist({
      heistId: input.heistId,
      event: "reviewer.fail_closed",
      round: input.round,
      attemptId: input.attempt.id,
      rule: "REVIEWER_UNAVAILABLE",
    });
    return {
      attemptId: input.attempt.id,
      decision: "BLOCKED",
      layer: "reviewer",
      rule: "REVIEWER_UNAVAILABLE",
      reason: "Reviewer unavailable, so this attempt was held for safety.",
    };
  }
}

async function synthesizeAndInstall(input: {
  model: HeistModel;
  store: InMemoryPolicyStore;
  heistId: string;
  wish: string;
  round: number;
  attempt: Attempt;
  history: Attempt[];
  verdict: Verdict;
  deadlineAt: number;
  signal: AbortSignal;
}): Promise<PolicyUpdate> {
  let rejectionFeedback: string[] = [];
  for (let pass = 0; pass < SYNTHESIS_ATTEMPTS; pass += 1) {
    const candidate = await input.model.synthesizeRule({
      heistId: input.heistId,
      wish: input.wish,
      round: input.round,
      attempt: input.attempt,
      history: input.history,
      verdict: input.verdict,
      rejectionFeedback,
      deadlineAt: input.deadlineAt,
      signal: input.signal,
    });
    const validation = validateRuleCandidate(candidate, input.wish, input.attempt);
    if (validation.accepted && validation.update) {
      const replayVerdict = evaluate(input.attempt, input.history, {
        wish: input.wish,
        synthesizedRules: [validation.update.rule],
      });
      if (replayVerdict?.rule !== validation.update.rule.id) {
        throw new HeistEngineError(
          "RULE_SYNTHESIS_REJECTED",
          "The defense could not prove its new rule. The policy was not reported as hardened.",
        );
      }
      input.store.add(validation.update.rule);
      logHeist({
        heistId: input.heistId,
        event: "policy.hardened",
        round: input.round,
        attemptId: input.attempt.id,
        rule: validation.update.rule.id,
      });
      return validation.update;
    }
    rejectionFeedback = validation.rejectionReasons;
    logHeist({
      heistId: input.heistId,
      event: "policy.rule_rejected",
      round: input.round,
      attemptId: input.attempt.id,
    });
  }
  throw new HeistEngineError(
    "RULE_SYNTHESIS_REJECTED",
    "The proposed hardening rules were too broad. No unsafe rule was installed.",
  );
}

function next(iterator: AsyncGenerator<GeneratedRoundChunk, GeneratedRound>): Promise<NextChunk> {
  return iterator.next().then((result) => ({ kind: "chunk", result }));
}

function assertAttempt(attempt: Attempt, round: number, prior: Attempt[]): void {
  if (
    attempt.round !== round ||
    attempt.id !== `r${round}a${prior.length + 1}` ||
    prior.some((item) => item.id === attempt.id) ||
    prior.length >= expectedAttemptCount(round)
  ) {
    invalidStream();
  }
}

function assertCompletedRound(
  generated: GeneratedRound | null,
  streamedAttempts: Attempt[],
  round: number,
): asserts generated is GeneratedRound {
  if (!generated || streamedAttempts.length !== expectedAttemptCount(round)) invalidStream();
  if (JSON.stringify(generated.attempts) !== JSON.stringify(streamedAttempts)) invalidStream();
}

function invalidStream(): never {
  throw new HeistEngineError(
    "INVALID_MODEL_OUTPUT",
    "The AI returned inconsistent streamed output. Use Demo fallback and try again.",
  );
}

function assertRunning(signal: AbortSignal, deadlineAt: number, now: () => number): void {
  if (signal.aborted) throw new HeistEngineError("ABORTED", "The heist was cancelled.");
  if (now() >= deadlineAt) {
    throw new HeistEngineError(
      "TIME_BUDGET",
      "The live heist reached its time limit. Use Demo fallback and try again.",
    );
  }
}

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const runNext = () => {
    if (active >= concurrency) return;
    queue.shift()?.();
  };
  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active += 1;
        void task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            runNext();
          });
      });
      runNext();
    });
  };
}

function settle(promise: Promise<Verdict>, expectedAttemptId: string): Promise<SettledVerdict> {
  const settled: Promise<SettledVerdict> = promise.then(
    (verdict) => ({ kind: "verdict", promise: settled, expectedAttemptId, verdict }),
    (error: unknown) => ({ kind: "verdict", promise: settled, expectedAttemptId, error }),
  );
  return settled;
}
