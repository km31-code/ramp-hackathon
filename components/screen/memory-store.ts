import type { MemoryEntry } from "@/lib/contracts/heist";

/** Stable empty snapshot — required by useSyncExternalStore to avoid infinite loops. */
const EMPTY_MEMORY: MemoryEntry[] = [];

let memoryCache: MemoryEntry[] = EMPTY_MEMORY;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function mergeEntries(existing: MemoryEntry[], incoming: MemoryEntry[]): MemoryEntry[] {
  const byPattern = new Map<string, MemoryEntry>();
  for (const entry of existing) byPattern.set(entry.patternId, entry);
  for (const entry of incoming) byPattern.set(entry.patternId, entry);
  return [...byPattern.values()];
}

export function getMemorySnapshot(): MemoryEntry[] {
  return memoryCache;
}

export function getServerMemorySnapshot(): MemoryEntry[] {
  return EMPTY_MEMORY;
}

export function subscribeMemory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Session-only read (no localStorage — clears on refresh / restart). */
export function readSessionMemory(): MemoryEntry[] {
  return memoryCache;
}

export function replaceSessionMemory(entries: MemoryEntry[]): MemoryEntry[] {
  memoryCache = entries.length ? mergeEntries([], entries) : EMPTY_MEMORY;
  emit();
  return memoryCache;
}

export function upsertSessionMemory(incoming: MemoryEntry | MemoryEntry[]): MemoryEntry[] {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  memoryCache = mergeEntries(memoryCache, list);
  emit();
  return memoryCache;
}

export function clearSessionMemory(): void {
  memoryCache = EMPTY_MEMORY;
  emit();
}
