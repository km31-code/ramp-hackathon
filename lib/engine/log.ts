import { safeErrorDetails } from "@/lib/engine/errors";

interface HeistLogEntry {
  heistId: string;
  event: string;
  round?: number;
  attemptId?: string;
  durationMs?: number;
  rule?: string;
  model?: string;
  attemptCount?: number;
  winner?: "house" | "schemer";
  error?: unknown;
}

/**
 * Operational logs intentionally exclude the wish, prompts, headers, and API key.
 */
export function logHeist(entry: HeistLogEntry): void {
  const { error, ...details } = entry;
  const payload = {
    at: new Date().toISOString(),
    ...details,
    ...(error === undefined ? {} : safeErrorDetails(error)),
  };
  const line = `[expense-heist] ${JSON.stringify(payload)}`;

  if (error === undefined) {
    console.info(line);
  } else {
    console.error(line);
  }
}
