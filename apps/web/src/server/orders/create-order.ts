import { products } from "@/data/seed";
import { calcSubtotal } from "@/features/catalog/pricing";
import { OrderCreateSchema, type OrderCreateInput } from "@sabzineh/types";

/**
 * Server-side order preview (Week 4 turns this into the real
 * create-order flow with Prisma + idempotency).
 *
 * The client sends only product ids + quantities. Prices and stock
 * are re-read from the catalogue here — a forged total from the
 * client is ignored by construction.
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

export function buildOrderPreview(input: OrderCreateInput): OrderPreview {
  const parsed = OrderCreateSchema.parse(input);
  const lines: OrderPreviewLine[] = parsed.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    if (product.stock < item.qty) {
      throw new Error(`Insufficient stock for product: ${product.title}`);
    }
    return {
      productId: product.id,
      title: product.title,
      vendorId: product.vendorId,
      qty: item.qty,
      unitPrice: product.price,
      lineTotal: product.price * item.qty,
    };
  });
  return {
    lines,
    subtotal: calcSubtotal(lines.map((l) => ({ price: l.unitPrice, qty: l.qty }))),
    vendorIds: [...new Set(lines.map((l) => l.vendorId))],
  };
}
