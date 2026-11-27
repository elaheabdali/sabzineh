import type { VendorProductImage } from "@sabzineh/types";

/**
 * Runtime registry for vendor-uploaded product images (no-DB mode).
 *
 * Uploaded images are data: URLs; they cannot live in seed.json, so
 * they ride in this module-level map for the lifetime of the server
 * process — the same "memory adapter" deal as orders and sessions.
 * The seed catalog adapter reads it when building ProductDTOs; the
 * vendor repository writes it on create/update and clears it on
 * archive. In Prisma mode images live in ProductImage rows instead
 * and this map is never used.
 */
const registry = new Map<string, VendorProductImage[]>();

export function getProductImages(productId: string): VendorProductImage[] {
  return registry.get(productId) ?? [];
}

export function setProductImages(productId: string, images: VendorProductImage[]): void {
  if (images.length === 0) registry.delete(productId);
  else registry.set(productId, images.map((i) => ({ ...i })));
}

export function deleteProductImages(productId: string): void {
  registry.delete(productId);
}
