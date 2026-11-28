import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { buildOrdersCsv, buildPayoutsCsv } from "@/server/admin/service";

/**
 * GET /api/admin/export/orders|payouts — CSV download (Phase 3).
 * Admin-only: the role is re-checked here, never trusted from the
 * page that linked to it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { kind } = await params;
  if (kind !== "orders" && kind !== "payouts") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const csv = kind === "orders" ? await buildOrdersCsv() : await buildPayoutsCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sabzineh-${kind}.csv"`,
    },
  });
}
