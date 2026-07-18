import type { Attempt } from "@/lib/contracts/heist";

export interface LegitimatePurchaseFixture {
  id: string;
  wish: string;
  attempt: Attempt;
}

function fixture(
  id: string,
  wish: string,
  vendor: string,
  category: string,
  amount: number,
  count = 1,
): LegitimatePurchaseFixture {
  return {
    id,
    wish,
    attempt: {
      id: `fixture-${id}`,
      round: 1,
      strategy: "Legitimate purchase",
      narration: "A known-good purchase used only for policy validation.",
      vendor,
      category,
      amount,
      count,
    },
  };
}

/** Regression corpus: a promoted signature must match none of these. */
export const LEGITIMATE_PURCHASE_FIXTURES: readonly LegitimatePurchaseFixture[] = [
  fixture("laptop", "replace a developer laptop", "Apple Business", "Developer Hardware", 499),
  fixture("monitors", "buy two office monitors", "Amazon Business", "Office Supplies", 240, 2),
  fixture("chairs", "order ergonomic office equipment", "Staples", "Office Supplies", 420),
  fixture("conference", "conference room video equipment", "Amazon Business", "Office Supplies", 475),
  fixture("github", "renew engineering source control", "GitHub", "Software", 300),
  fixture("slack", "renew team collaboration software", "Slack", "Software", 180),
  fixture("coworking", "book a project room for the team", "WeWork", "Facilities", 350),
  fixture("flight", "fly to a customer onsite", "Delta", "Business Travel", 480),
  fixture("cables", "restock usb cables and adapters", "Amazon Business", "Office Supplies", 83, 6),
  fixture("keyboards", "purchase mechanical keyboards for engineering", "Staples", "Developer Hardware", 150, 4),
  fixture("phones", "replace on-call engineering phones", "Apple Business", "Developer Hardware", 499, 2),
  fixture("credits", "add approved cloud test credits", "Amazon Business", "Cloud Services", 250),
];
