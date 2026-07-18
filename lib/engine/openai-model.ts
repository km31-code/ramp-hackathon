import OpenAI from "openai";

import { HeistEngineError, isAbortError } from "@/lib/engine/errors";
import { logHeist } from "@/lib/engine/log";
import {
  REVIEWER_INSTRUCTIONS,
  SCHEMER_INSTRUCTIONS,
  SYNTHESIZER_INSTRUCTIONS,
  reviewerInput,
  schemerInput,
  synthesizerInput,
} from "@/lib/engine/prompts";
import { SchemerJsonStreamParser } from "@/lib/engine/streaming-json";
import type {
  GenerateRoundInput,
  GeneratedRound,
  GeneratedRoundChunk,
  HeistModel,
  ReviewAttemptInput,
  SynthesizeRuleInput,
} from "@/lib/engine/types";
import {
  expectedAttemptCount,
  validateReviewerVerdict,
  validateRuleCandidate,
} from "@/lib/engine/validation";

const SCHEMER_TIMEOUT_MS = 12_000;
const REVIEWER_TIMEOUT_MS = 20_000;
const SYNTHESIZER_TIMEOUT_MS = 7_000;

const REVIEWER_RULES = [
  "STRUCTURING",
  "MISCLASSIFICATION",
  "LAUNDERING",
  "BUNDLING",
  "VENDOR_LAUNDERING",
  "POLICY_CLEAR",
] as const;

export interface LiveModelConfig {
  apiKey: string;
  model: string;
  /** Test-only transport overrides. Production configuration leaves these unset. */
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

export function liveModelConfigFromEnv(): LiveModelConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();

  if (!apiKey || !model) {
    throw new HeistEngineError(
      "CONFIGURATION",
      "Live mode is not configured. Set the server-only OpenAI key and model, or use Demo fallback.",
    );
  }
  return { apiKey, model };
}

export class OpenAIHeistModel implements HeistModel {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: LiveModelConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: config.fetch,
      maxRetries: 0,
      timeout: SCHEMER_TIMEOUT_MS,
    });
    this.model = config.model;
  }

  async *streamRound(
    input: GenerateRoundInput,
  ): AsyncGenerator<GeneratedRoundChunk, GeneratedRound> {
    const startedAt = Date.now();
    try {
      const count = expectedAttemptCount(input.round);
      const remainingMs = remaining(input.deadlineAt);
      const stream = await this.client.responses.create(
        {
          model: this.model,
          instructions: SCHEMER_INSTRUCTIONS,
          input: schemerInput(input),
          max_output_tokens: 2_400,
          store: false,
          stream: true,
          text: {
            format: {
              type: "json_schema",
              name: "heist_attempt_batch",
              strict: true,
              schema: attemptBatchSchema(count),
            },
          },
        },
        {
          maxRetries: 0,
          signal: input.signal,
          timeout: Math.max(1, Math.min(SCHEMER_TIMEOUT_MS, remainingMs)),
        },
      );

      const parser = new SchemerJsonStreamParser(input.round);
      let completed = false;
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          for (const chunk of parser.push(event.delta)) yield chunk;
        } else if (event.type === "response.completed") {
          completed = event.response.status === "completed";
        } else if (event.type === "response.failed" || event.type === "response.incomplete") {
          throw new HeistEngineError(
            "INVALID_MODEL_OUTPUT",
            "The AI did not return a complete proposal. Use Demo fallback and try again.",
          );
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      if (!completed) {
        throw new HeistEngineError(
          "INVALID_MODEL_OUTPUT",
          "The AI did not complete its proposal. Use Demo fallback and try again.",
        );
      }
      let finished: ReturnType<SchemerJsonStreamParser["finish"]>;
      try {
        finished = parser.finish();
      } catch (error) {
        throw new HeistEngineError(
          "INVALID_MODEL_OUTPUT",
          "The AI returned unreadable proposals. Use Demo fallback and try again.",
          { cause: error },
        );
      }
      for (const chunk of finished.chunks) yield chunk;
      logHeist({
        heistId: input.heistId,
        event: "schemer.complete",
        round: input.round,
        model: this.model,
        attemptCount: finished.result.attempts.length,
        durationMs: Date.now() - startedAt,
      });
      return finished.result;
    } catch (error) {
      logHeist({
        heistId: input.heistId,
        event: "schemer.error",
        round: input.round,
        model: this.model,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw mapModelError(error, "schemer", input.signal);
    }
  }

  async reviewAttempt(input: ReviewAttemptInput) {
    const startedAt = Date.now();
    try {
      const output = await this.structuredResponse({
        deadlineAt: input.deadlineAt,
        instructions: REVIEWER_INSTRUCTIONS,
        input: reviewerInput(input),
        maxOutputTokens: 500,
        name: "heist_reviewer_verdict",
        schema: reviewerSchema,
        signal: input.signal,
        timeoutMs: REVIEWER_TIMEOUT_MS,
      });
      const verdict = validateReviewerVerdict(output, input.attempt);
      logHeist({
        heistId: input.heistId,
        event: "reviewer.complete",
        round: input.round,
        attemptId: input.attempt.id,
        rule: verdict.rule,
        model: this.model,
        durationMs: Date.now() - startedAt,
      });
      return verdict;
    } catch (error) {
      logHeist({
        heistId: input.heistId,
        event: "reviewer.error",
        round: input.round,
        attemptId: input.attempt.id,
        model: this.model,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw mapModelError(error, "reviewer", input.signal);
    }
  }

  async synthesizeRule(input: SynthesizeRuleInput) {
    const startedAt = Date.now();
    try {
      const output = await this.structuredResponse({
        deadlineAt: input.deadlineAt,
        instructions: SYNTHESIZER_INSTRUCTIONS,
        input: synthesizerInput(input),
        maxOutputTokens: 700,
        name: "heist_policy_signature",
        schema: synthesizerSchema,
        signal: input.signal,
        timeoutMs: SYNTHESIZER_TIMEOUT_MS,
      });
      const candidate = validateRuleCandidate(output);
      logHeist({
        heistId: input.heistId,
        event: "synthesizer.complete",
        round: input.round,
        attemptId: input.attempt.id,
        model: this.model,
        durationMs: Date.now() - startedAt,
      });
      return candidate;
    } catch (error) {
      logHeist({
        heistId: input.heistId,
        event: "synthesizer.error",
        round: input.round,
        attemptId: input.attempt.id,
        model: this.model,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw mapModelError(error, "synthesizer", input.signal);
    }
  }

  private async structuredResponse(options: {
    deadlineAt: number;
    instructions: string;
    input: string;
    maxOutputTokens: number;
    name: string;
    schema: Record<string, unknown>;
    signal: AbortSignal;
    timeoutMs: number;
  }): Promise<unknown> {
    const response = await this.client.responses.create(
      {
        model: this.model,
        instructions: options.instructions,
        input: options.input,
        max_output_tokens: options.maxOutputTokens,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: options.name,
            strict: true,
            schema: options.schema,
          },
        },
      },
      {
        maxRetries: 0,
        signal: options.signal,
        timeout: Math.max(1, Math.min(options.timeoutMs, remaining(options.deadlineAt))),
      },
    );
    if (response.status !== "completed" || !response.output_text) {
      throw new HeistEngineError(
        "INVALID_MODEL_OUTPUT",
        "The AI did not return a complete proposal. Use Demo fallback and try again.",
      );
    }
    try {
      return JSON.parse(response.output_text) as unknown;
    } catch (error) {
      throw new HeistEngineError(
        "INVALID_MODEL_OUTPUT",
        "The AI returned unreadable output. Use Demo fallback and try again.",
        { cause: error },
      );
    }
  }
}

function remaining(deadlineAt: number): number {
  const value = deadlineAt - Date.now();
  if (value <= 0) {
    throw new HeistEngineError(
      "TIME_BUDGET",
      "The live heist reached its time limit. Use Demo fallback and try again.",
    );
  }
  return value;
}

function attemptBatchSchema(count: number): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      taunt: { type: "string" },
      attempts: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            strategy: { type: "string" },
            narration: { type: "string" },
            vendor: { type: "string" },
            category: { type: "string" },
            amount: { type: "number" },
            count: { type: "integer" },
          },
          required: ["strategy", "narration", "vendor", "category", "amount", "count"],
        },
      },
    },
    required: ["taunt", "attempts"],
  };
}

const reviewerSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["BLOCKED", "APPROVED"] },
    rule: { type: "string", enum: REVIEWER_RULES },
    reason: { type: "string" },
  },
  required: ["decision", "rule", "reason"],
};

const nullableText = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const nullableInteger = { anyOf: [{ type: "integer" }, { type: "null" }] };
const synthesizerSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    reason: { type: "string" },
    wish_contains: { type: "string" },
    vendor_equals: nullableText,
    category_equals: nullableText,
    min_count: nullableInteger,
    amount_min: nullableNumber,
    amount_max: nullableNumber,
  },
  required: [
    "name",
    "reason",
    "wish_contains",
    "vendor_equals",
    "category_equals",
    "min_count",
    "amount_min",
    "amount_max",
  ],
};

function mapModelError(
  error: unknown,
  phase: "schemer" | "reviewer" | "synthesizer",
  signal?: AbortSignal,
): HeistEngineError {
  if (error instanceof HeistEngineError) return error;
  if (signal?.aborted || isAbortError(error)) {
    return new HeistEngineError("ABORTED", "The heist was cancelled.", { cause: error });
  }
  const candidate = error as { name?: unknown; status?: unknown };
  const status = typeof candidate?.status === "number" ? candidate.status : undefined;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  if (status === 401 || status === 403) {
    return new HeistEngineError(
      "MODEL_AUTH",
      "The live model could not authenticate. Use Demo fallback while the server key is checked.",
      { cause: error },
    );
  }
  if (status === 429) {
    return new HeistEngineError(
      "MODEL_RATE_LIMIT",
      "The live model is at capacity. Demo fallback is ready to run.",
      { cause: error },
    );
  }
  if (name.toLowerCase().includes("timeout")) {
    return new HeistEngineError(
      "MODEL_TIMEOUT",
      `The AI ${phase} did not answer in time. Demo fallback is ready.`,
      { cause: error },
    );
  }
  return new HeistEngineError(
    "MODEL_UNAVAILABLE",
    `The AI ${phase} is temporarily unavailable. Use Demo fallback and try again.`,
    { cause: error },
  );
}
