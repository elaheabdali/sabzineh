import { getCatalogRepository } from "@/features/catalog/repository";
import { calcSubtotal } from "@/features/catalog/pricing";
import { OrderCreateSchema, type OrderCreateInput } from "@sabzineh/types";

/**
 * Server-side order preview (Week 3: real flow in server/orders/service).
 *
 * The client sends only product ids + quantities. Prices and stock
 * are re-read from the catalogue here — a forged total from the
 * client is ignored by construction. Products are resolved through
 * the catalog repository, so the preview is correct in both data
 * modes (Prisma / seed).
 */
export interface OrderPreviewLine {
  productId: string;
  title: string;
  vendorId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderPreview {
  lines: OrderPreviewLine[];
  subtotal: number;
  vendorIds: string[];
}

export async function buildOrderPreview(input: OrderCreateInput): Promise<OrderPreview> {
  const parsed = OrderCreateSchema.parse(input);
  return previewItems(parsed.items);
}

/** Price/stock re-read for raw cart lines (used by checkout math). */
export async function previewItems(
  items: { productId: string; qty: number }[],
): Promise<OrderPreview> {
  const repo = getCatalogRepository();
  const lines: OrderPreviewLine[] = [];
  for (const item of items) {
    const product = await repo.getProductById(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    if (product.status !== "PUBLISHED") {
      throw new Error(`Product is not for sale: ${product.title}`);
    }
    if (product.stock < item.qty) {
      throw new Error(`Insufficient stock for product: ${product.title}`);
    }
    lines.push({
      productId: product.id,
      title: product.title,
      vendorId: product.vendorId,
      qty: item.qty,
      unitPrice: product.price,
      lineTotal: product.price * item.qty,
    });
  }
  return {
    lines,
    subtotal: calcSubtotal(lines.map((l) => ({ price: l.unitPrice, qty: l.qty }))),
    vendorIds: [...new Set(lines.map((l) => l.vendorId))],
  };
}
