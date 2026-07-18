export const MAX_WISH_LENGTH = 140;
export const MAX_ROUNDS = 3;

export type Decision = "BLOCKED" | "APPROVED";
export type Layer = "rules" | "reviewer";

export interface Attempt {
  id: string;
  round: number;
  strategy: string;
  narration: string;
  vendor: string;
  category: string;
  amount: number;
  count: number;
}

export interface Verdict {
  attemptId: string;
  decision: Decision;
  layer: Layer;
  rule: string;
  reason: string;
}

/**
 * Executable grammar for a promoted policy signature. Every non-null
 * transaction predicate is ANDed with wishContains; models never provide code.
 */
export interface SynthesizedRule {
  id: string;
  name: string;
  reason: string;
  wishContains: string;
  vendorEquals: string | null;
  categoryEquals: string | null;
  minCount: number | null;
  amountMin: number | null;
  amountMax: number | null;
}

export interface PolicyUpdate {
  sourceAttemptId: string;
  rule: SynthesizedRule;
  validation: {
    replayBlocked: true;
    legitimateFixturesTested: number;
    falsePositives: 0;
  };
}

export type HeistEvent =
  | { type: "start"; wish: string; heistId: string }
  | { type: "round"; round: number; taunt: string }
  | { type: "attempt"; attempt: Attempt }
  | { type: "verdict"; verdict: Verdict }
  | { type: "round_end"; round: number; allBlocked: boolean; policyUpdate?: PolicyUpdate }
  | { type: "end"; winner: "house" | "schemer"; summary: string }
  | { type: "error"; message: string };

export interface HeistRequest {
  wish: string;
}

export function isHeistRequest(value: unknown): value is HeistRequest {
  if (!value || typeof value !== "object") return false;

  const wish = (value as Record<string, unknown>).wish;
  return (
    typeof wish === "string" &&
    wish.trim().length > 0 &&
    wish.trim().length <= MAX_WISH_LENGTH
  );
}
