import type { Attempt, SynthesizedRule, Verdict } from "@/lib/contracts/heist";

export interface DenialFeedback {
  strategy: string;
  rule: string;
  reason: string;
}

export interface GenerateRoundInput {
  heistId: string;
  wish: string;
  round: number;
  denialFeedback: DenialFeedback[];
  activeRules: SynthesizedRule[];
  deadlineAt: number;
  signal: AbortSignal;
}

export interface GeneratedRound {
  attempts: Attempt[];
  taunt: string;
}

export type GeneratedRoundChunk =
  | { type: "round"; taunt: string }
  | { type: "attempt"; attempt: Attempt };

export interface ReviewAttemptInput {
  heistId: string;
  wish: string;
  round: number;
  attempt: Attempt;
  history: Attempt[];
  calibration: "standard" | "breach-window";
  deadlineAt: number;
  signal: AbortSignal;
}

export interface RuleCandidate {
  name: string;
  reason: string;
  wishContains: string;
  vendorEquals: string | null;
  categoryEquals: string | null;
  minCount: number | null;
  amountMin: number | null;
  amountMax: number | null;
}

export interface SynthesizeRuleInput {
  heistId: string;
  wish: string;
  round: number;
  attempt: Attempt;
  history: Attempt[];
  verdict: Verdict;
  rejectionFeedback: string[];
  deadlineAt: number;
  signal: AbortSignal;
}

export interface HeistModel {
  streamRound(input: GenerateRoundInput): AsyncGenerator<GeneratedRoundChunk, GeneratedRound>;
  reviewAttempt(input: ReviewAttemptInput): Promise<Verdict>;
  synthesizeRule(input: SynthesizeRuleInput): Promise<RuleCandidate>;
}
