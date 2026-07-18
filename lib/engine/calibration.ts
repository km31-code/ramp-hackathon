/**
 * One deterministic bucket in five receives a deliberately permissive semantic
 * evidence posture. Hard rules and promoted signatures are never bypassed.
 */
export function calibrationForHeist(heistId: string): "standard" | "breach-window" {
  let hash = 2166136261;
  for (const character of heistId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 5 === 0 ? "breach-window" : "standard";
}
