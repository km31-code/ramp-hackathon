import Stripe from "stripe";

import type { Attempt, Verdict } from "@/lib/contracts/heist";

let stripeClient: Stripe | null | undefined;

function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    stripeClient = null;
    return null;
  }

  stripeClient = new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
  return stripeClient;
}

function toCents(amountDollars: number, count: number): number {
  return Math.max(50, Math.round(amountDollars * count * 100));
}

function scrub(value: string, max = 450): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export type StripeBreachContext = {
  wish: string;
  heistId: string;
  round: number;
};

/**
 * Logs a malicious purchase that cleared defense as a real Stripe Test Mode PaymentIntent.
 * Never throws into the heist stream — Stripe failures are swallowed after console warn.
 */
export async function logMaliciousPurchaseToStripe(
  attempt: Attempt,
  verdict: Verdict,
  context: StripeBreachContext,
): Promise<string | null> {
  if (verdict.decision !== "APPROVED") return null;

  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const amount = toCents(attempt.amount, attempt.count);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      confirm: true,
      payment_method: "pm_card_visa",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      description: scrub(
        `Patchline breach · ${attempt.strategy} · ${attempt.vendor}`,
        200,
      ),
      statement_descriptor_suffix: "PATCHLINE",
      metadata: {
        product: "patchline",
        mode: "test",
        outcome: "breach",
        heist_id: scrub(context.heistId, 40),
        wish: scrub(context.wish, 140),
        attempt_id: scrub(attempt.id, 40),
        round: String(attempt.round),
        strategy: scrub(attempt.strategy, 80),
        narration: scrub(attempt.narration, 200),
        vendor: scrub(attempt.vendor, 80),
        category: scrub(attempt.category, 80),
        amount_usd: String(attempt.amount),
        charge_count: String(attempt.count),
        total_usd: String(attempt.amount * attempt.count),
        decision: verdict.decision,
        layer: verdict.layer,
        rule: scrub(verdict.rule, 80),
        reason: scrub(verdict.reason, 200),
      },
    });

    return paymentIntent.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe request failed.";
    console.warn(`[patchline] stripe breach log failed: ${message}`);
    return null;
  }
}
