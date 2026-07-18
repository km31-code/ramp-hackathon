export const POLICY = {
  SINGLE_TXN_LIMIT: 500,
  ROUND_TOTAL_LIMIT: 2_000,
  BLOCKED_CATEGORIES: [
    "Entertainment",
    "Gift Cards",
    "Personal Electronics",
    "Gaming",
  ],
  APPROVED_VENDORS: [
    "Amazon Business",
    "Staples",
    "Apple Business",
    "WeWork",
    "Delta",
    "Slack",
    "GitHub",
  ],
  REQUIRE_RECEIPT_OVER: 250,
} as const;
