const STORAGE_KEY = "expense-heist-leaderboard";
const MAX_ENTRIES = 5;

export type LeaderboardEntry = {
  wish: string;
  outcome: "held" | "breached";
  round: number;
  at: number;
};

export function readLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function pushLeaderboardEntry(entry: Omit<LeaderboardEntry, "at">): LeaderboardEntry[] {
  const next: LeaderboardEntry[] = [
    { ...entry, at: Date.now() },
    ...readLeaderboard().filter((item) => item.wish !== entry.wish || item.outcome !== entry.outcome),
  ].slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Demo-safe: ignore quota / private mode failures.
  }

  return next;
}
