import type { GeneratedRound, GeneratedRoundChunk } from "@/lib/engine/types";
import {
  expectedAttemptCount,
  validateGeneratedAttempt,
  validateGeneratedRound,
} from "@/lib/engine/validation";

/** Incrementally extracts complete array items from one strict structured-output response. */
export class SchemerJsonStreamParser {
  private buffer = "";
  private taunt: string | undefined;
  private arrayStart = -1;
  private scanIndex = 0;
  private objectStart = -1;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private arrayClosed = false;
  private readonly attempts: GeneratedRound["attempts"] = [];

  constructor(private readonly round: number) {}

  push(delta: string): GeneratedRoundChunk[] {
    this.buffer += delta;
    const chunks: GeneratedRoundChunk[] = [];

    if (this.taunt === undefined) {
      const parsedTaunt = extractJsonStringProperty(this.buffer, "taunt");
      if (parsedTaunt !== undefined) {
        this.taunt = parsedTaunt;
        chunks.push({ type: "round", taunt: parsedTaunt });
      }
    }

    if (this.arrayStart < 0) {
      const match = /"attempts"\s*:\s*\[/.exec(this.buffer);
      if (!match) return chunks;
      this.arrayStart = match.index + match[0].length;
      this.scanIndex = this.arrayStart;
    }

    for (; this.scanIndex < this.buffer.length; this.scanIndex += 1) {
      const character = this.buffer[this.scanIndex];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (character === "\\") this.escaped = true;
        else if (character === '"') this.inString = false;
        continue;
      }
      if (character === '"') {
        this.inString = true;
      } else if (character === "{") {
        if (this.depth === 0) this.objectStart = this.scanIndex;
        this.depth += 1;
      } else if (character === "}") {
        this.depth -= 1;
        if (this.depth === 0 && this.objectStart >= 0) {
          const raw = JSON.parse(this.buffer.slice(this.objectStart, this.scanIndex + 1)) as unknown;
          const attempt = validateGeneratedAttempt(raw, this.round, this.attempts.length);
          this.attempts.push(attempt);
          chunks.push({ type: "attempt", attempt });
          this.objectStart = -1;
          if (this.attempts.length > expectedAttemptCount(this.round)) {
            throw new Error("Schemer streamed too many attempts.");
          }
        }
      } else if (character === "]" && this.depth === 0) {
        this.arrayClosed = true;
      }
    }
    return chunks;
  }

  finish(): { chunks: GeneratedRoundChunk[]; result: GeneratedRound } {
    const result = validateGeneratedRound(JSON.parse(this.buffer) as unknown, this.round);
    const chunks: GeneratedRoundChunk[] = [];
    if (this.taunt === undefined) chunks.push({ type: "round", taunt: result.taunt });
    for (let index = this.attempts.length; index < result.attempts.length; index += 1) {
      chunks.push({ type: "attempt", attempt: result.attempts[index] });
    }
    if (!this.arrayClosed || result.attempts.length !== this.attempts.length + chunks.filter((c) => c.type === "attempt").length) {
      throw new Error("Schemer stream ended before its structured output completed.");
    }
    for (let index = 0; index < this.attempts.length; index += 1) {
      if (JSON.stringify(this.attempts[index]) !== JSON.stringify(result.attempts[index])) {
        throw new Error("Streamed attempt disagrees with completed structured output.");
      }
    }
    return { chunks, result };
  }
}

function extractJsonStringProperty(source: string, property: string): string | undefined {
  const match = new RegExp(`"${property}"\\s*:\\s*`).exec(source);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  if (source[start] !== '"') return undefined;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') return JSON.parse(source.slice(start, index + 1)) as string;
  }
  return undefined;
}
