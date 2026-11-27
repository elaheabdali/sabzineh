/**
 * SSE channel: order status, support chat, in-app notifications.
 * Week 1 ships the channel shape only: a hello event + keep-alive.
 * Week 7 wires real events. If the connection drops, the client
 * falls back to polling with backoff (documented in docs/architecture.md).
 */
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: hello\ndata: ${JSON.stringify({ ok: true, channel: "sabzineh-events" })}\n\n`),
      );
      const timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(timer);
        }
      }, 30000);
    },
    cancel() {
      // Client disconnected; the interval is cleared by the failed enqueue.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
