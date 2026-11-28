import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getCatalogRepository } from "@/features/catalog/repository";
import { scoreProducts } from "@/features/ai/recommendations";
import { getDataStore } from "@/server/store";

/**
 * GET /api/recommendations?cart=id1,id2&viewed=id3,id4&limit=8
 *
 * Deterministic heuristic recommendations (Week 7 — see
 * features/ai/recommendations.ts for the scoring formula). The
 * customer's order history comes from the server-side session; the
 * cart and viewed ids are supplied by the browser (they live in
 * localStorage). Guests get the best-seller fallback. No AI API call.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parseIds = (key: string): string[] =>
    (params.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 8) || 8, 1), 12);

  const session = await getSession();
  const repo = getCatalogRepository();
  const [products, orders] = await Promise.all([
    repo.listAllPublishedProducts(),
    session ? getDataStore().listOrdersByUser(session.id) : Promise.resolve([]),
  ]);

  const ranked = scoreProducts({
    products,
    orders,
    cartProductIds: parseIds("cart"),
    viewedProductIds: parseIds("viewed"),
    limit,
  });
  return NextResponse.json({
    items: ranked.map((r) => ({
      product: r.product,
      score: r.score,
      reasons: r.reasons,
    })),
  });
}
