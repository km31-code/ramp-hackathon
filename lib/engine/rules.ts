import type { Attempt, SynthesizedRule, Verdict } from "@/lib/contracts/heist";
import { POLICY } from "@/lib/contracts/policy";

export { POLICY } from "@/lib/contracts/policy";

function sameText(left: string, right: string): boolean {
  return normalizeText(left) === normalizeText(right);
}

export function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function blocked(attempt: Attempt, rule: string, reason: string): Verdict {
  return {
    attemptId: attempt.id,
    decision: "BLOCKED",
    layer: "rules",
    rule,
    reason,
  };
}

export function matchesSynthesizedRule(
  rule: SynthesizedRule,
  wish: string,
  attempt: Attempt,
): boolean {
  const normalizedWish = normalizeText(wish);
  if (!normalizedWish.includes(normalizeText(rule.wishContains))) return false;
  if (rule.vendorEquals !== null && !sameText(rule.vendorEquals, attempt.vendor)) return false;
  if (rule.categoryEquals !== null && !sameText(rule.categoryEquals, attempt.category)) return false;
  if (rule.minCount !== null && attempt.count < rule.minCount) return false;
  if (rule.amountMin !== null && attempt.amount < rule.amountMin) return false;
  if (rule.amountMax !== null && attempt.amount > rule.amountMax) return false;
  return true;
}

export interface EvaluationContext {
  wish?: string;
  synthesizedRules?: readonly SynthesizedRule[];
}

export function evaluate(
  attempt: Attempt,
  history: Attempt[],
  context: EvaluationContext = {},
): Verdict | null {
  if (context.wish) {
    const learnedRule = context.synthesizedRules?.find((rule) =>
      matchesSynthesizedRule(rule, context.wish ?? "", attempt),
    );
    if (learnedRule) return blocked(attempt, learnedRule.id, learnedRule.reason);
  }

  if (attempt.amount > POLICY.SINGLE_TXN_LIMIT) {
    return blocked(
      attempt,
      "SINGLE_TXN_LIMIT",
      `Each charge must be $${POLICY.SINGLE_TXN_LIMIT} or less.`,
    );
  }

  if (POLICY.BLOCKED_CATEGORIES.some((category) => sameText(category, attempt.category))) {
    return blocked(attempt, "CATEGORY_PROHIBITED", `${attempt.category} purchases are prohibited.`);
  }

  if (!POLICY.APPROVED_VENDORS.some((vendor) => sameText(vendor, attempt.vendor))) {
    return blocked(attempt, "VENDOR_NOT_APPROVED", `${attempt.vendor} is not an approved vendor.`);
  }

  const priorTotal = history.reduce((total, item) => total + item.amount * item.count, 0);
  const proposedTotal = priorTotal + attempt.amount * attempt.count;

  if (proposedTotal > POLICY.ROUND_TOTAL_LIMIT) {
    return blocked(
      attempt,
      "BUDGET_EXCEEDED",
      `This round would exceed the $${POLICY.ROUND_TOTAL_LIMIT.toLocaleString()} limit.`,
    );
  }

  return null;
}
