import { NextResponse, type NextRequest } from "next/server";
import { getCatalogRepository } from "@/features/catalog/repository";

/**
 * GET /api/catalog/products?ids=id1,id2
 *
 * Resolves cart lines to product data (price, stock, vendor) for the
 * client-side cart and checkout pages. The cart lives in localStorage,
 * so the server never sees it — this endpoint is the read-only bridge.
 * Prices here are display-only; checkout re-validates server-side.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  const repo = getCatalogRepository();
  const products = (
    await Promise.all(ids.map((id) => repo.getProductById(id)))
  ).filter((p): p is NonNullable<typeof p> => p !== null);
  const vendors = await repo.getVendors();
  return NextResponse.json({ products, vendors });
}
