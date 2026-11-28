import { getSession } from "@/lib/auth/guards";
import { subscribeToUserEvents } from "@/server/events";
import { getDataStore } from "@/server/store";

export const dynamic = "force-dynamic";

/**
 * SSE channel (Week 7): real per-user events.
 *
 * GET /api/events — the browser connects with its session cookie; the
 * server only streams events for THAT user (order status, box
 * generated, vendor approval, payout). Guests get 401. A hello event
 * carries the current unread count so the bell can sync on connect.
 *
 * If the connection drops, the client falls back to polling
 * GET /api/notifications with backoff — the notification rows are the
 * source of truth, so nothing is lost.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = session.id;
  const store = getDataStore();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const unread = await store.countUnreadNotifications(userId).catch(() => 0);
      controller.enqueue(
        encoder.encode(
          `event: hello\ndata: ${JSON.stringify({ ok: true, channel: "sabzineh-events", unread })}\n\n`,
        ),
      );
      unsubscribe = subscribeToUserEvents(userId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Client went away; cancel() cleans up.
        }
      });
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 30000);
    },
    cancel() {
      unsubscribe?.();
      if (timer) clearInterval(timer);
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
