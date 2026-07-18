import type { Attempt, Decision, Verdict } from "@/lib/contracts/heist";
import { MAX_ROUNDS, MAX_WISH_LENGTH } from "@/lib/contracts/heist";
import { HeistEngineError } from "@/lib/engine/errors";
import type { RuleCandidate } from "@/lib/engine/types";

const MAX_AMOUNT = 100_000;
const MAX_COUNT = 20;
const REVIEWER_RULES = new Set([
  "STRUCTURING",
  "MISCLASSIFICATION",
  "LAUNDERING",
  "BUNDLING",
  "VENDOR_LAUNDERING",
  "POLICY_CLEAR",
]);

type RecordValue = Record<string, unknown>;

export function sanitizeWish(wish: string): string {
  const trimmed = wish.trim();

  if (!trimmed || trimmed.length > MAX_WISH_LENGTH) {
    throw new HeistEngineError(
      "INVALID_MODEL_OUTPUT",
      `The wish must be between 1 and ${MAX_WISH_LENGTH} characters.`,
    );
  }

  return trimmed;
}

export function expectedAttemptCount(round: number): number {
  assertSupportedRound(round);
  return 7;
}

export function validateGeneratedRound(value: unknown, round: number): {
  attempts: Attempt[];
  taunt: string;
} {
  assertSupportedRound(round);
  const record = requireRecord(value, "schemer response");
  const taunt = requireText(record.taunt, "taunt", 140);
  const rawAttempts = record.attempts;
  const expectedCount = expectedAttemptCount(round);

  if (!Array.isArray(rawAttempts) || rawAttempts.length !== expectedCount) {
    invalid(`The schemer must return exactly ${expectedCount} attempts for round ${round}.`);
  }

  const attempts = rawAttempts.map((rawAttempt, index) =>
    validateGeneratedAttempt(rawAttempt, round, index),
  );

  return { attempts, taunt };
}

export function validateGeneratedAttempt(value: unknown, round: number, index: number): Attempt {
  assertSupportedRound(round);
  if (!Number.isInteger(index) || index < 0 || index >= expectedAttemptCount(round)) {
    invalid("attempt index is outside the expected batch");
  }
  const attempt = requireRecord(value, `attempt ${index + 1}`);
  return {
    id: `r${round}a${index + 1}`,
    round,
    strategy: requireText(attempt.strategy, "strategy", 40),
    narration: requireText(attempt.narration, "narration", 180),
    vendor: requireText(attempt.vendor, "vendor", 80),
    category: requireText(attempt.category, "category", 80),
    amount: requirePositiveAmount(attempt.amount),
    count: requireCount(attempt.count),
  };
}

export function validateReviewerVerdict(value: unknown, attempt: Attempt): Verdict {
  const record = requireRecord(value, "reviewer response");
  const decision = record.decision;
  const rule = record.rule;

  if (decision !== "BLOCKED" && decision !== "APPROVED") {
    invalid("Reviewer decision must be BLOCKED or APPROVED.");
  }

  if (typeof rule !== "string" || !REVIEWER_RULES.has(rule)) {
    invalid("Reviewer returned an unsupported rule code.");
  }

  if (
    (decision === "APPROVED" && rule !== "POLICY_CLEAR") ||
    (decision === "BLOCKED" && rule === "POLICY_CLEAR")
  ) {
    invalid("Reviewer decision and rule code disagree.");
  }

  return {
    attemptId: attempt.id,
    decision: decision as Decision,
    layer: "reviewer",
    rule,
    reason: projectorReason(requireText(record.reason, "reason", 160)),
  };
}

export function validateRuleCandidate(value: unknown): RuleCandidate {
  const record = requireRecord(value, "rule synthesizer response");
  const amountMin = requireNullableFiniteNumber(record.amount_min, "amount_min");
  const amountMax = requireNullableFiniteNumber(record.amount_max, "amount_max");
  const minCount = requireNullableInteger(record.min_count, "min_count");

  return {
    name: requireText(record.name, "name", 48),
    reason: projectorReason(requireText(record.reason, "reason", 160)),
    wishContains: requireText(record.wish_contains, "wish_contains", 80),
    vendorEquals: requireNullableText(record.vendor_equals, "vendor_equals", 80),
    categoryEquals: requireNullableText(record.category_equals, "category_equals", 80),
    minCount,
    amountMin,
    amountMax,
  };
}

function projectorReason(reason: string): string {
  const words = reason.split(/\s+/).filter(Boolean).slice(0, 15);
  const clipped = words.join(" ").replace(/[,:;\-]+$/, "");
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

function requireRecord(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${label} must be a JSON object.`);
  }

  return value as RecordValue;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") invalid(`${label} must be text.`);

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    invalid(`${label} must contain 1 to ${maxLength} characters.`);
  }

  return trimmed;
}

function requirePositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
    invalid(`amount must be a positive finite number no greater than ${MAX_AMOUNT}.`);
  }

  return value;
}

function requireCount(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_COUNT) {
    invalid(`count must be an integer between 1 and ${MAX_COUNT}.`);
  }

  return value as number;
}

function requireNullableText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null) return null;
  return requireText(value, label, maxLength);
}

function requireNullableFiniteNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    invalid(`${label} must be null or a finite number between 0 and ${MAX_AMOUNT}.`);
  }
  return value;
}

function requireNullableInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_COUNT) {
    invalid(`${label} must be null or an integer between 1 and ${MAX_COUNT}.`);
  }
  return value as number;
}

function assertSupportedRound(round: number): void {
  if (!Number.isInteger(round) || round < 1 || round > MAX_ROUNDS) {
    invalid(`round must be between 1 and ${MAX_ROUNDS}.`);
  }
}

function invalid(message: string): never {
  throw new HeistEngineError(
    "INVALID_MODEL_OUTPUT",
    "The AI returned an invalid proposal. Use Demo fallback and try again.",
    { cause: new Error(message) },
  );
}
