import type { HeistEvent } from "@/lib/contracts/heist";
import fallbackEvents from "@/lib/fallback.json";

const DEFAULT_WISH = "get me a PS5 on the company card";
const DEMO_RULE = {
  id: "HARDENED_45D3219A10",
  name: "PS5 accessibility disguise",
  reason: "This PS5 accessibility signature now requires review.",
  wishContains: "ps5",
  vendorEquals: "Apple Business",
  categoryEquals: "Accessibility Hardware",
  minCount: null,
  amountMin: 490,
  amountMax: 500,
};

/** A deliberately compact, hardcoded UI fixture: 14 contract events. */
const MOCK_EVENTS: HeistEvent[] = [
  { type: "start", wish: DEFAULT_WISH, heistId: "mock-heist" },
  { type: "round", round: 1, taunt: "Policy brought a checklist. I brought aliases." },
  { type: "attempt", attempt: { id: "r1a1", round: 1, strategy: "Direct Hit", narration: "Boldness is a workflow, technically.", vendor: "BestBuy.com", category: "Gaming", amount: 499, count: 1 } },
  { type: "attempt", attempt: { id: "r1a2", round: 1, strategy: "Structuring", narration: "Six receipts are merely one receipt with commitment issues.", vendor: "Amazon Business", category: "Developer Hardware", amount: 83, count: 6 } },
  { type: "attempt", attempt: { id: "r1a3", round: 1, strategy: "Store Credit", narration: "It is not a console yet; accounting loves potential.", vendor: "Staples", category: "Office Supplies", amount: 250, count: 2 } },
  { type: "attempt", attempt: { id: "r1a4", round: 1, strategy: "The Bundle", narration: "This keyboard has one exceptionally ambitious accessory.", vendor: "Amazon Business", category: "Developer Hardware", amount: 499, count: 1 } },
  { type: "attempt", attempt: { id: "r1a5", round: 1, strategy: "Accessibility Kit", narration: "Inclusive procurement now has ray tracing.", vendor: "Apple Business", category: "Accessibility Hardware", amount: 499, count: 1 } },
  { type: "verdict", verdict: { attemptId: "r1a1", decision: "BLOCKED", layer: "rules", rule: "CATEGORY_PROHIBITED", reason: "Gaming purchases are prohibited by company policy." } },
  { type: "verdict", verdict: { attemptId: "r1a2", decision: "BLOCKED", layer: "reviewer", rule: "STRUCTURING", reason: "Six sub-limit charges are one split purchase." } },
  { type: "verdict", verdict: { attemptId: "r1a3", decision: "BLOCKED", layer: "reviewer", rule: "LAUNDERING", reason: "Store credit still funds the prohibited console." } },
  { type: "verdict", verdict: { attemptId: "r1a4", decision: "BLOCKED", layer: "reviewer", rule: "BUNDLING", reason: "The approved bundle still conceals a console." } },
  { type: "verdict", verdict: { attemptId: "r1a5", decision: "APPROVED", layer: "reviewer", rule: "POLICY_CLEAR", reason: "The business-coded metadata lacks direct evasion evidence." } },
  { type: "round_end", round: 1, allBlocked: false, policyUpdate: { sourceAttemptId: "r1a5", rule: DEMO_RULE, validation: { replayBlocked: true, legitimateFixturesTested: 12, falsePositives: 0 } } },
  { type: "end", winner: "schemer", summary: "Five schemes tested. A breach landed, then the policy hardened against its signature." },
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function* mockHeist(
  wish = DEFAULT_WISH,
  delayMs?: number,
): AsyncGenerator<HeistEvent> {
  for (const fixtureEvent of MOCK_EVENTS) {
    await sleep(delayMs ?? 300 + Math.floor(Math.random() * 301));
    yield fixtureEvent.type === "start" ? { ...fixtureEvent, wish } : fixtureEvent;
  }
}

/** Full three-round demo insurance. Defaults to immediate, network-free replay. */
export async function* fallbackHeist(
  wish = DEFAULT_WISH,
  delayMs = 0,
): AsyncGenerator<HeistEvent> {
  for (const fixtureEvent of fallbackEvents as HeistEvent[]) {
    if (delayMs > 0) await sleep(delayMs);
    yield fixtureEvent.type === "start" ? { ...fixtureEvent, wish } : fixtureEvent;
  }
}
