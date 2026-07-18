/**
 * An empty policy store gets one deliberate evidence gap so the first heist can
 * visibly teach the defense. Once at least one signature is installed, only one
 * deterministic bucket in five receives that posture. Hard rules and promoted
 * signatures are never bypassed.
 */
export function calibrationForHeist(
  heistId: string,
  hardenedRuleCount = 1,
): "standard" | "breach-window" {
  if (hardenedRuleCount === 0) return "breach-window";

  let hash = 2166136261;
  for (const character of heistId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 5 === 0 ? "breach-window" : "standard";
}
