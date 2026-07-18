import type { MemoryEntry } from "@/lib/contracts/heist";

/** In-process only — cleared when the Next.js server restarts. */
let sessionEntries: MemoryEntry[] = [];

function mergeEntries(existing: MemoryEntry[], incoming: MemoryEntry[]): MemoryEntry[] {
  const byPattern = new Map<string, MemoryEntry>();
  for (const entry of existing) byPattern.set(entry.patternId, entry);
  for (const entry of incoming) byPattern.set(entry.patternId, entry);
  return [...byPattern.values()];
}

export async function readAttackMemory(): Promise<MemoryEntry[]> {
  return sessionEntries;
}

export async function persistAttackMemory(entries: MemoryEntry[]): Promise<number> {
  sessionEntries = mergeEntries(sessionEntries, entries);
  return sessionEntries.length;
}

export function clearAttackMemory(): void {
  sessionEntries = [];
}
