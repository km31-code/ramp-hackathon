import { isHeistRequest, MAX_WISH_LENGTH } from "@/lib/contracts/heist";
import type { HeistEvent } from "@/lib/contracts/heist";
import { isAbortError, publicErrorMessage } from "@/lib/engine/errors";
import { runHeist } from "@/lib/engine/heist";
import { OpenAIHeistModel, liveModelConfigFromEnv } from "@/lib/engine/openai-model";
import { fallbackHeist } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
        try {
          const source =
            mode === "live"
              ? runHeist(wish, {
                  model: new OpenAIHeistModel(liveModelConfigFromEnv()),
                  signal: abortController.signal,
                })
              : fallbackHeist(wish, 150);

          for await (const event of source) {
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
