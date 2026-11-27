import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";

/**
 * GET /api/notifications — the polling fallback for the SSE channel
 * and the data source for the notifications center. Session-scoped:
 * a user only ever sees their own rows.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = getDataStore();
  const [notifications, unread] = await Promise.all([
    store.listNotifications(session.id),
    store.countUnreadNotifications(session.id),
  ]);
  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  });
}
