export type HeistErrorCode =
  | "ABORTED"
  | "CONFIGURATION"
  | "INVALID_MODEL_OUTPUT"
  | "MODEL_AUTH"
  | "MODEL_RATE_LIMIT"
  | "MODEL_TIMEOUT"
  | "MODEL_UNAVAILABLE"
  | "RULE_SYNTHESIS_REJECTED"
  | "TIME_BUDGET";

export class HeistEngineError extends Error {
  readonly code: HeistErrorCode;
  readonly publicMessage: string;

  constructor(
    code: HeistErrorCode,
    publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
    this.name = "HeistEngineError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof HeistEngineError && error.code === "ABORTED") ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof HeistEngineError) return error.publicMessage;

  return "The live defense hit an unexpected error. Use Demo fallback and try again.";
}

export function safeErrorDetails(error: unknown): {
  errorName: string;
  errorCode?: string;
  status?: number;
} {
  if (!error || typeof error !== "object") return { errorName: typeof error };

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
  };

  return {
    errorName: typeof candidate.name === "string" ? candidate.name : "UnknownError",
    ...(typeof candidate.code === "string" ? { errorCode: candidate.code } : {}),
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
  };
}
