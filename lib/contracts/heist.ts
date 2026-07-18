export const MAX_WISH_LENGTH = 140;
export const MAX_ROUNDS = 3;

export type Decision = "BLOCKED" | "APPROVED";
export type Layer = "rules" | "reviewer";

export interface Attempt {
  id: string;
  round: number;
  patternId: string;
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
  memoryId?: string;
}

export interface MemoryEntry {
  id: string;
  label: string;
  summary: string;
  patternId: string;
}

export interface Scorecard {
  breaches: number;
  patternsLearned: number;
  prShipped: boolean;
}

export type HeistEvent =
  | { type: "start"; wish: string; heistId: string }
  | { type: "round"; round: number; taunt: string }
  | { type: "attempt"; attempt: Attempt }
  | { type: "verdict"; verdict: Verdict }
  | { type: "memory"; entry: MemoryEntry }
  | { type: "memory_hit"; memoryId: string; attemptId: string }
  | { type: "round_end"; round: number; allBlocked: boolean }
  | { type: "patch"; title: string; filename: string; diff: string }
  | { type: "persist"; count: number }
  | {
      type: "pr";
      status: "opened" | "preview";
      title: string;
      url?: string;
      body?: string;
    }
  | {
      type: "end";
      winner: "house" | "schemer";
      summary: string;
      scorecard?: Scorecard;
    }
  | { type: "error"; message: string };

export interface HeistRequest {
  wish: string;
  /** Pattern ids already stored in Attack Memory from prior wishes. */
  knownPatternIds?: string[];
}

export function isHeistRequest(value: unknown): value is HeistRequest {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const wish = record.wish;
  if (
    typeof wish !== "string" ||
    wish.trim().length === 0 ||
    wish.trim().length > MAX_WISH_LENGTH
  ) {
    return false;
  }

  if (record.knownPatternIds === undefined) return true;
  if (!Array.isArray(record.knownPatternIds)) return false;
  return record.knownPatternIds.every((item) => typeof item === "string");
}
