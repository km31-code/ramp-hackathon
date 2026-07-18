import { isHeistRequest, MAX_WISH_LENGTH } from "@/lib/contracts/heist";
import type { Attempt, HeistEvent } from "@/lib/contracts/heist";
import { isAbortError, publicErrorMessage } from "@/lib/engine/errors";
import { runHeist } from "@/lib/engine/heist";
import { OpenAIHeistModel, liveModelConfigFromEnv } from "@/lib/engine/openai-model";
import { mockHeist } from "@/lib/mock";
import { logMaliciousPurchaseToStripe } from "@/lib/stripe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeistMode = "live" | "mock";

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

  const wish = body.wish.trim();
  const mode = heistMode();
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let cancelled = false;
  const abortFromRequest = () => abortController.abort(request.signal.reason);
  request.signal.addEventListener("abort", abortFromRequest, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: HeistEvent): boolean => {
        if (cancelled || abortController.signal.aborted) return false;

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          return true;
        } catch {
          cancelled = true;
          abortController.abort();
          return false;
        }
      };

      void (async () => {
        let heistId = "unknown";
        let round = 1;
        const attempts = new Map<string, Attempt>();

        try {
          const source =
            mode === "live"
              ? runHeist(wish, {
                  model: new OpenAIHeistModel(liveModelConfigFromEnv()),
                  signal: abortController.signal,
                })
              : mockHeist(wish);

          for await (const event of source) {
            if (event.type === "start") heistId = event.heistId;
            if (event.type === "round") round = event.round;
            if (event.type === "attempt") attempts.set(event.attempt.id, event.attempt);

            if (event.type === "verdict" && event.verdict.decision === "APPROVED") {
              const attempt = attempts.get(event.verdict.attemptId);
              if (attempt) {
                // Fire-and-await so the dashboard entry exists before the stream ends,
                // but never block or fail the demo on Stripe errors.
                await logMaliciousPurchaseToStripe(attempt, event.verdict, {
                  wish,
                  heistId,
                  round,
                });
              }
            }

            if (!enqueue(event)) break;
          }
        } catch (error) {
          if (!abortController.signal.aborted && !isAbortError(error)) {
            enqueue({ type: "error", message: publicErrorMessage(error) });
          }
        } finally {
          request.signal.removeEventListener("abort", abortFromRequest);
          if (!cancelled) {
            try {
              controller.close();
            } catch {
              // A disconnected browser may close the stream before this pump finishes.
            }
          }
        }
      })();
    },
    cancel(reason) {
      cancelled = true;
      abortController.abort(reason);
      request.signal.removeEventListener("abort", abortFromRequest);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Heist-Mode": mode,
    },
  });
}

function heistMode(): HeistMode {
  return process.env.HEIST_MODE?.trim().toLowerCase() === "live" ? "live" : "mock";
}
