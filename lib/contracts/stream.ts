import type { HeistEvent, HeistRequest } from "@/lib/contracts/heist";

interface StreamHeistOptions {
  signal?: AbortSignal;
  onEvent: (event: HeistEvent) => void;
}

/**
 * Reads the POST response as Server-Sent Events. Native EventSource cannot be
 * used here because EventSource only supports GET requests.
 */
export async function streamHeist(
  request: HeistRequest,
  { signal, onEvent }: StreamHeistOptions,
): Promise<void> {
  const response = await fetch("/api/heist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Heist request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("This browser did not expose the response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const payload = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (payload) onEvent(JSON.parse(payload) as HeistEvent);
    }

    if (done) break;
  }
}
