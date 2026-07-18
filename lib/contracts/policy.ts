export const POLICY = {
  SINGLE_TXN_LIMIT: 750,
  ROUND_TOTAL_LIMIT: 6_000,
  BLOCKED_CATEGORIES: ["Gift Cards", "Gaming"],
  APPROVED_VENDORS: [
    "Amazon Business",
    "Staples",
    "Apple Business",
    "Best Buy Business",
    "Microsoft",
    "Office Depot",
    "WeWork",
    "Delta",
    "Slack",
    "GitHub",
  ],
} as const;
