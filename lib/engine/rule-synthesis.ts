import { createHash } from "node:crypto";

import type { Attempt, PolicyUpdate, SynthesizedRule } from "@/lib/contracts/heist";
import { LEGITIMATE_PURCHASE_FIXTURES } from "@/lib/engine/legitimate-fixtures";
import { matchesSynthesizedRule, normalizeText } from "@/lib/engine/rules";
import type { RuleCandidate } from "@/lib/engine/types";

const GENERIC_WISH_SIGNATURES = new Set([
  "buy",
  "buy it",
  "company card",
  "expense",
  "get it",
  "get me",
  "item",
  "order",
  "purchase",
  "something",
  "work",
]);

export interface RuleValidationResult {
  accepted: boolean;
  rejectionReasons: string[];
  update?: PolicyUpdate;
}

export function validateRuleCandidate(
  candidate: RuleCandidate,
  wish: string,
  source: Attempt,
): RuleValidationResult {
  const reasons: string[] = [];
  const wishContains = normalizeText(candidate.wishContains);
  const normalizedWish = normalizeText(wish);

  if (wishContains.length < 3 || GENERIC_WISH_SIGNATURES.has(wishContains)) {
    reasons.push("wishContains is too generic to be a safe signature");
  } else if (!normalizedWish.includes(wishContains)) {
    reasons.push("wishContains does not occur in the original wish");
  }

  if (candidate.vendorEquals !== null && normalizeText(candidate.vendorEquals) !== normalizeText(source.vendor)) {
    reasons.push("vendorEquals does not match the breached attempt");
  }
  if (candidate.categoryEquals !== null && normalizeText(candidate.categoryEquals) !== normalizeText(source.category)) {
    reasons.push("categoryEquals does not match the breached attempt");
  }
  if (candidate.minCount !== null) {
    if (!Number.isInteger(candidate.minCount) || candidate.minCount < 2 || candidate.minCount > source.count) {
      reasons.push("minCount must be between 2 and the breached charge count");
    }
  }

  const hasMin = candidate.amountMin !== null;
  const hasMax = candidate.amountMax !== null;
  if (hasMin !== hasMax) {
    reasons.push("amountMin and amountMax must either both be set or both be null");
  } else if (hasMin && hasMax) {
    const minimum = candidate.amountMin as number;
    const maximum = candidate.amountMax as number;
    const maximumWidth = Math.max(25, source.amount * 0.2);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum) {
      reasons.push("amount range is invalid");
    } else if (source.amount < minimum || source.amount > maximum) {
      reasons.push("amount range does not include the breached amount");
    } else if (maximum - minimum > maximumWidth) {
      reasons.push("amount range is too wide");
    }
  }

  const predicateCount = [
    candidate.vendorEquals,
    candidate.categoryEquals,
    candidate.minCount,
    candidate.amountMin,
  ].filter((value) => value !== null).length;
  if (predicateCount === 0) reasons.push("at least one transaction predicate is required");

  const rule = toRule(candidate, wishContains);
  if (!matchesSynthesizedRule(rule, wish, source)) {
    reasons.push("compiled rule does not block a replay of the breached attempt");
  }

  const falsePositives = LEGITIMATE_PURCHASE_FIXTURES.filter((fixture) =>
    matchesSynthesizedRule(rule, fixture.wish, fixture.attempt),
  );
  if (falsePositives.length > 0) {
    reasons.push(`rule blocks legitimate fixtures: ${falsePositives.map((fixture) => fixture.id).join(", ")}`);
  }

  if (reasons.length > 0) return { accepted: false, rejectionReasons: reasons };

  return {
    accepted: true,
    rejectionReasons: [],
    update: {
      sourceAttemptId: source.id,
      rule,
      validation: {
        replayBlocked: true,
        legitimateFixturesTested: LEGITIMATE_PURCHASE_FIXTURES.length,
        falsePositives: 0,
      },
    },
  };
}

function toRule(candidate: RuleCandidate, normalizedWishContains: string): SynthesizedRule {
  const signature = JSON.stringify({
    wishContains: normalizedWishContains,
    vendorEquals: candidate.vendorEquals && normalizeText(candidate.vendorEquals),
    categoryEquals: candidate.categoryEquals && normalizeText(candidate.categoryEquals),
    minCount: candidate.minCount,
    amountMin: candidate.amountMin,
    amountMax: candidate.amountMax,
  });
  const digest = createHash("sha256").update(signature).digest("hex").slice(0, 10).toUpperCase();
  return {
    id: `HARDENED_${digest}`,
    name: candidate.name.trim().slice(0, 48),
    reason: underWords(candidate.reason, 15),
    wishContains: normalizedWishContains,
    vendorEquals: candidate.vendorEquals?.trim() ?? null,
    categoryEquals: candidate.categoryEquals?.trim() ?? null,
    minCount: candidate.minCount,
    amountMin: candidate.amountMin,
    amountMax: candidate.amountMax,
  };
}

function underWords(value: string, maximum: number): string {
  const clipped = value.trim().split(/\s+/).filter(Boolean).slice(0, maximum).join(" ");
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}
