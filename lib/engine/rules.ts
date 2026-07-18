import type { Attempt, Verdict } from "@/lib/contracts/heist";
import { POLICY } from "@/lib/contracts/policy";

export { POLICY } from "@/lib/contracts/policy";

function sameText(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: "accent" }) === 0;
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

export function evaluate(attempt: Attempt, history: Attempt[]): Verdict | null {
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
