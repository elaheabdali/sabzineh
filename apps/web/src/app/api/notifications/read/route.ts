import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";

/**
 * POST /api/notifications/read — { id?: string, all?: true }.
 * Marks one notification read (only when it belongs to the caller)
 * or every unread notification of the caller. Returns the new unread
 * count so the header bell can sync without another round-trip.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  const store = getDataStore();
  if (body.all === true) {
    await store.markAllNotificationsRead(session.id);
  } else if (typeof body.id === "string" && body.id.length > 0) {
    await store.markNotificationRead(session.id, body.id);
  } else {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }
  const unread = await store.countUnreadNotifications(session.id);
  return NextResponse.json({ ok: true, unread });
}
