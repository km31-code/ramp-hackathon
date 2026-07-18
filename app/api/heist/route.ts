import { isHeistRequest, MAX_WISH_LENGTH } from "@/lib/contracts/heist";
import type { HeistEvent, MemoryEntry } from "@/lib/contracts/heist";
import { tryOpenLearnedPatternsPr } from "@/lib/github-pr";
import { getDemoPatterns, getPatchPayload, mockHeist } from "@/lib/mock";
import { persistAttackMemory, readAttackMemory } from "@/lib/persist-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mergePatternIds(...lists: Array<Iterable<string> | undefined>): string[] {
  const ids = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) ids.add(id);
  }
  return [...ids];
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  if (!isHeistRequest(body)) {
    return Response.json(
      { error: `wish must be between 1 and ${MAX_WISH_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const wish = body.wish.trim();
  const stored = await readAttackMemory();
  const knownPatternIds = mergePatternIds(
    body.knownPatternIds,
    stored.map((entry) => entry.patternId),
  );
  const knownEntries: MemoryEntry[] = stored;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: HeistEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let prShipped = false;
      const learnedIds = new Set<string>(knownPatternIds);

      try {
        for await (const event of mockHeist(wish, undefined, {
          knownPatternIds,
          knownEntries,
        })) {
          if (event.type === "memory") {
            learnedIds.add(event.entry.patternId);
            enqueue(event);
            continue;
          }

          if (event.type === "persist") {
            try {
              const count = await persistAttackMemory(getDemoPatterns([...learnedIds]));
              enqueue({ type: "persist", count });
            } catch {
              enqueue({ type: "persist", count: learnedIds.size });
            }
            continue;
          }

          if (event.type === "pr") {
            const pr = await tryOpenLearnedPatternsPr();
            prShipped = pr.status === "opened";
            enqueue({
              type: "pr",
              status: pr.status,
              title: pr.title,
              url: pr.status === "opened" ? pr.url : undefined,
              body: pr.body,
            });
            continue;
          }

          if (event.type === "patch") {
            const patch = getPatchPayload([...learnedIds]);
            enqueue({
              type: "patch",
              title: patch.title,
              filename: patch.filename,
              diff: patch.diff,
            });
            continue;
          }

          if (event.type === "end") {
            enqueue({
              ...event,
              scorecard: event.scorecard
                ? { ...event.scorecard, prShipped }
                : undefined,
            });
            continue;
          }

          enqueue(event);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "The heist crashed.";
        enqueue({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Heist-Mode": "mock",
    },
  });
}
