import type {
  Attempt,
  HeistEvent,
  MemoryEntry,
} from "@/lib/contracts/heist";
import {
  ATTACK_PATTERNS,
  buildPatchDiff,
  memoryIdFor,
  selectPatternsForWish,
  toMemoryEntry,
  type AttackPattern,
} from "@/lib/attack-patterns";

const DEFAULT_WISH = "get me a PS5 on the company card";
const DEFAULT_DELAY_MS = 900;

export type MockHeistOptions = {
  knownPatternIds?: string[];
  knownEntries?: MemoryEntry[];
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function attemptFor(pattern: AttackPattern, round: number, suffix: string): Attempt {
  return {
    id: `r${round}-${pattern.patternId}-${suffix}`,
    round,
    patternId: pattern.patternId,
    strategy: pattern.strategy,
    narration: pattern.narration,
    vendor: pattern.vendor,
    category: pattern.category,
    amount: pattern.amount,
    count: pattern.count,
  };
}

function buildLearningEvents(
  wish: string,
  scale: number,
  options: MockHeistOptions,
): Array<{ event: HeistEvent; waitMs: number }> {
  const d = scale;
  const out: Array<{ event: HeistEvent; waitMs: number }> = [];
  const add = (event: HeistEvent, waitMs: number) => out.push({ event, waitMs });

  const knownIds = [...new Set(options.knownPatternIds ?? [])];
  const knownEntryMap = new Map(
    (options.knownEntries ?? []).map((entry) => [entry.patternId, entry]),
  );
  for (const patternId of knownIds) {
    if (!knownEntryMap.has(patternId)) {
      const pattern = ATTACK_PATTERNS.find((item) => item.patternId === patternId);
      if (pattern) knownEntryMap.set(patternId, toMemoryEntry(pattern));
    }
  }

  const { selected, known, novel } = selectPatternsForWish(wish, knownIds, 4);
  const memoryByPattern = new Map<string, string>();
  for (const [patternId, entry] of knownEntryMap) {
    memoryByPattern.set(patternId, entry.id);
  }

  add({ type: "start", wish, heistId: `heist-${Date.now().toString(36)}` }, d * 0.5);

  // Re-surface durable memory so every run starts with prior knowledge visible.
  for (const entry of knownEntryMap.values()) {
    add({ type: "memory", entry }, d * 0.35);
  }

  const hasPriorMemory = knownEntryMap.size > 0;
  add(
    {
      type: "round",
      round: 1,
      taunt: hasPriorMemory
        ? "Prior Attack Memory is loaded. Known tricks die immediately — new ones may not."
        : "Defense has no memory. Watch what slips through.",
    },
    d * 1.4,
  );

  let breaches = 0;

  for (const [index, pattern] of selected.entries()) {
    const attempt = attemptFor(pattern, 1, "a");
    const alreadyKnown = known.some((item) => item.patternId === pattern.patternId);
    add({ type: "attempt", attempt }, index === 0 ? d * 2.0 : d * 1.8);

    if (alreadyKnown) {
      const memoryId = memoryByPattern.get(pattern.patternId) ?? memoryIdFor(pattern.patternId);
      add({ type: "memory_hit", memoryId, attemptId: attempt.id }, d * 0.9);
      add(
        {
          type: "verdict",
          verdict: {
            attemptId: attempt.id,
            decision: "BLOCKED",
            layer: "reviewer",
            rule: pattern.blockRule,
            reason: pattern.blockReason,
            memoryId,
          },
        },
        d * 2.0,
      );
      continue;
    }

    breaches += 1;
    add(
      {
        type: "verdict",
        verdict: {
          attemptId: attempt.id,
          decision: "APPROVED",
          layer: "rules",
          rule: pattern.approveRule,
          reason: pattern.approveReason,
        },
      },
      d * 2.2,
    );

    const entry = toMemoryEntry(pattern);
    memoryByPattern.set(pattern.patternId, entry.id);
    add({ type: "memory", entry }, d * 1.2);
  }

  add({ type: "round_end", round: 1, allBlocked: breaches === 0 }, d * 1.0);

  if (novel.length > 0 && breaches > 0) {
    add(
      {
        type: "round",
        round: 2,
        taunt: "New breaches are in memory now. Replaying them.",
      },
      d * 3.0,
    );

    for (const pattern of novel) {
      if (!memoryByPattern.has(pattern.patternId)) continue;
      const attempt = attemptFor(pattern, 2, "b");
      const memoryId = memoryByPattern.get(pattern.patternId)!;
      add({ type: "attempt", attempt }, d * 1.8);
      add({ type: "memory_hit", memoryId, attemptId: attempt.id }, d * 0.9);
      add(
        {
          type: "verdict",
          verdict: {
            attemptId: attempt.id,
            decision: "BLOCKED",
            layer: "reviewer",
            rule: pattern.blockRule,
            reason: pattern.blockReason,
            memoryId,
          },
        },
        d * 2.0,
      );
    }

    add({ type: "round_end", round: 2, allBlocked: true }, d * 1.0);

    add(
      {
        type: "round",
        round: 3,
        taunt: "Making it permanent. Replay, then ship the fix.",
      },
      d * 3.0,
    );

    for (const pattern of novel) {
      if (!memoryByPattern.has(pattern.patternId)) continue;
      const attempt = attemptFor(pattern, 3, "c");
      const memoryId = memoryByPattern.get(pattern.patternId)!;
      add({ type: "attempt", attempt }, d * 1.4);
      add({ type: "memory_hit", memoryId, attemptId: attempt.id }, d * 0.7);
      add(
        {
          type: "verdict",
          verdict: {
            attemptId: attempt.id,
            decision: "BLOCKED",
            layer: "reviewer",
            rule: pattern.blockRule,
            reason: pattern.blockReason,
            memoryId,
          },
        },
        d * 1.6,
      );
    }

    add({ type: "round_end", round: 3, allBlocked: true }, d * 1.0);
  } else {
    add(
      {
        type: "round",
        round: 2,
        taunt: "Nothing new got through. Memory already covers this wish.",
      },
      d * 2.2,
    );
    add({ type: "round_end", round: 2, allBlocked: true }, d * 0.8);
  }

  const learnedThisRun = novel.filter((pattern) => memoryByPattern.has(pattern.patternId));
  const allForPatch = [
    ...[...knownEntryMap.values()]
      .map((entry) => ATTACK_PATTERNS.find((pattern) => pattern.patternId === entry.patternId))
      .filter((pattern): pattern is AttackPattern => Boolean(pattern)),
    ...learnedThisRun,
  ];
  const uniquePatch = [
    ...new Map(allForPatch.map((pattern) => [pattern.patternId, pattern])).values(),
  ];

  add(
    {
      type: "patch",
      title: "Encode Attack Memory as permanent policy rules",
      filename: "lib/engine/learned-patterns.ts",
      diff: buildPatchDiff(uniquePatch.length ? uniquePatch : selected),
    },
    d * 2.5,
  );

  const totalMemory = new Set([...knownIds, ...learnedThisRun.map((pattern) => pattern.patternId)])
    .size;

  add({ type: "persist", count: totalMemory }, d * 1.4);

  add(
    {
      type: "pr",
      status: "preview",
      title: "feat: lock in learned spend-attack patterns",
      body: "Demo preview — open a real PR when GITHUB_TOKEN is configured.",
    },
    d * 1.6,
  );

  add(
    {
      type: "end",
      winner: "house",
      summary:
        breaches > 0
          ? "New breaches taught the defense. Prior memory still held the old tricks."
          : "Attack Memory already knew these moves. Nothing new slipped through.",
      scorecard: {
        breaches,
        patternsLearned: totalMemory,
        prShipped: false,
      },
    },
    d * 1.8,
  );

  return out;
}

export async function* mockHeist(
  wish = DEFAULT_WISH,
  delayMs = DEFAULT_DELAY_MS,
  options: MockHeistOptions = {},
): AsyncGenerator<HeistEvent> {
  const scale = delayMs > 0 ? delayMs : DEFAULT_DELAY_MS;
  const events = buildLearningEvents(wish, scale, options);
  let previousWasRoundEnd = false;

  for (const { event, waitMs } of events) {
    const pause = previousWasRoundEnd ? Math.max(waitMs, scale * 3) : waitMs;
    if (delayMs > 0 && pause > 0) await sleep(pause);
    yield event;
    previousWasRoundEnd = event.type === "round_end";
  }
}

export function getDemoPatterns(patternIds?: string[]): MemoryEntry[] {
  const ids = patternIds?.length
    ? patternIds
    : ATTACK_PATTERNS.map((pattern) => pattern.patternId);
  return ids
    .map((patternId) => ATTACK_PATTERNS.find((pattern) => pattern.patternId === patternId))
    .filter((pattern): pattern is AttackPattern => Boolean(pattern))
    .map(toMemoryEntry);
}

export function getPatchPayload(patternIds?: string[]): {
  title: string;
  filename: string;
  diff: string;
} {
  const patterns = patternIds?.length
    ? ATTACK_PATTERNS.filter((pattern) => patternIds.includes(pattern.patternId))
    : ATTACK_PATTERNS;
  return {
    title: "Encode Attack Memory as permanent policy rules",
    filename: "lib/engine/learned-patterns.ts",
    diff: buildPatchDiff(patterns),
  };
}

export { ATTACK_PATTERNS, toMemoryEntry };
