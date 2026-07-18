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

export type HeistEvent =
  | { type: "start"; wish: string; heistId: string }
  | { type: "round"; round: number; taunt: string }
  | { type: "attempt"; attempt: Attempt }
  | { type: "verdict"; verdict: Verdict }
  | { type: "round_end"; round: number; allBlocked: boolean }
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
