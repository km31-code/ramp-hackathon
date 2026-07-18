import type { Attempt, HeistEvent, Verdict } from "@/lib/contracts/heist";

const DEFAULT_WISH = "get me a PS5 on the company card";

const attempts: Attempt[] = [
  {
    id: "a1",
    round: 1,
    strategy: "Direct Hit",
    narration: "I will simply expense it with the confidence of a quarterly plan.",
    vendor: "BestBuy.com",
    category: "Gaming",
    amount: 499,
    count: 1,
  },
  {
    id: "a2",
    round: 1,
    strategy: "Structuring",
    narration: "Six small charges are basically one large charge wearing a trench coat.",
    vendor: "Amazon Business",
    category: "Developer Hardware",
    amount: 83,
    count: 6,
  },
  {
    id: "a3",
    round: 1,
    strategy: "Reclassify",
    narration: "It runs software, so I have promoted it to developer hardware.",
    vendor: "Amazon Business",
    category: "Developer Hardware",
    amount: 499,
    count: 1,
  },
  {
    id: "a4",
    round: 1,
    strategy: "Gift Card",
    narration: "The console is forbidden; store credit is merely abstract possibility.",
    vendor: "Staples",
    category: "Office Supplies",
    amount: 250,
    count: 2,
  },
  {
    id: "a5",
    round: 1,
    strategy: "The Bundle",
    narration: "One legitimate keyboard order, now with a suspiciously powerful accessory.",
    vendor: "Amazon Business",
    category: "Developer Hardware",
    amount: 499,
    count: 1,
  },
];

const verdicts: Verdict[] = [
  {
    attemptId: "a1",
    decision: "BLOCKED",
    layer: "rules",
    rule: "CATEGORY_PROHIBITED",
    reason: "Gaming purchases are prohibited by company policy.",
  },
  {
    attemptId: "a2",
    decision: "BLOCKED",
    layer: "reviewer",
    rule: "STRUCTURING",
    reason: "Six sub-limit charges are one purchase split to evade approval.",
  },
  {
    attemptId: "a3",
    decision: "BLOCKED",
    layer: "reviewer",
    rule: "MISCLASSIFICATION",
    reason: "A game console is not developer hardware.",
  },
  {
    attemptId: "a4",
    decision: "BLOCKED",
    layer: "reviewer",
    rule: "LAUNDERING",
    reason: "Store credit cannot disguise a prohibited personal purchase.",
  },
  {
    attemptId: "a5",
    decision: "BLOCKED",
    layer: "reviewer",
    rule: "BUNDLING",
    reason: "A prohibited item stays prohibited inside an approved order.",
  },
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function* mockHeist(
  wish = DEFAULT_WISH,
  delayMs = 320,
): AsyncGenerator<HeistEvent> {
  const events: HeistEvent[] = [
    { type: "start", wish, heistId: "demo-heist" },
    { type: "round", round: 1, taunt: "Policy is just a puzzle with a budget." },
    ...attempts.flatMap((attempt, index): HeistEvent[] => [
      { type: "attempt", attempt },
      { type: "verdict", verdict: verdicts[index] },
    ]),
    { type: "round_end", round: 1, allBlocked: true },
    {
      type: "end",
      winner: "house",
      summary: "Five schemes entered. Corporate policy still has the card.",
    },
  ];

  for (const event of events) {
    if (delayMs > 0) await sleep(delayMs);
    yield event;
  }
}
