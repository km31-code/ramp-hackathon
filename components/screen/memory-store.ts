import type { PolicyUpdate } from "@/lib/contracts/heist";

/** Stable empty snapshot required by useSyncExternalStore. */
const EMPTY_UPDATES: PolicyUpdate[] = [];

let updateCache: PolicyUpdate[] = EMPTY_UPDATES;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getPolicySnapshot(): PolicyUpdate[] {
  return updateCache;
}

export function getServerPolicySnapshot(): PolicyUpdate[] {
  return EMPTY_UPDATES;
}

export function subscribePolicy(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Screen-local display cache. The backend's bounded process store is authoritative. */
export function upsertPolicyUpdate(update: PolicyUpdate): PolicyUpdate[] {
  const byRule = new Map(updateCache.map((entry) => [entry.rule.id, entry]));
  byRule.set(update.rule.id, update);
  updateCache = [...byRule.values()];
  emit();
  return updateCache;
}
