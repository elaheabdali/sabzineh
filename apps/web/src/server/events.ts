/**
 * In-process realtime event bus (Week 7).
 *
 * One Node process = one bus. The SSE route subscribes the logged-in
 * user's browser here; server code publishes per-user events after
 * persisting the matching notification (see server/notifications.ts).
 *
 * Honest limitation: on serverless hosting each function instance has
 * its own bus, so an event published in one instance never reaches a
 * browser connected to another. The client therefore ALWAYS keeps the
 * polling fallback (GET /api/notifications) — SSE is a fast path, not
 * the only path. Nothing is lost when SSE drops: the notification
 * rows are the source of truth.
 */

export interface AppEvent {
  /** Notification type, e.g. "order-status", "box-generated". */
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

type Listener = (event: AppEvent) => void;

const globalForBus = globalThis as unknown as { sabzinehEventBus?: Map<string, Set<Listener>> };

function bus(): Map<string, Set<Listener>> {
  globalForBus.sabzinehEventBus ??= new Map();
  return globalForBus.sabzinehEventBus;
}

/** Publish an event to one user's subscribers only. */
export function publishEvent(userId: string, event: AppEvent): void {
  for (const listener of bus().get(userId) ?? []) {
    try {
      listener(event);
    } catch {
      // One broken subscriber must not break the publisher.
    }
  }
}

/** Subscribe to one user's events. Returns an unsubscribe function. */
export function subscribeToUserEvents(userId: string, listener: Listener): () => void {
  const map = bus();
  const set = map.get(userId) ?? new Set<Listener>();
  set.add(listener);
  map.set(userId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) map.delete(userId);
  };
}

/** Test helper: how many listeners a user currently has. */
export function countSubscribers(userId: string): number {
  return bus().get(userId)?.size ?? 0;
}
