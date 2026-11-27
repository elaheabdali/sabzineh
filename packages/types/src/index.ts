import { z } from "zod";

/**
 * Shared DTOs + Zod schemas. The same schema validates a form on the
 * client and the API payload on the server — one source of truth.
 */

export const RoleSchema = z.enum(["CUSTOMER", "VENDOR", "ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const SortSchema = z.enum(["newest", "cheapest", "priciest", "bestselling"]);
export type Sort = z.infer<typeof SortSchema>;

/** URL-synced faceted filter state (see features/catalog/filter.ts). */
export const FilterParamsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  vendor: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: z.coerce.boolean().optional(),
  organic: z.coerce.boolean().optional(),
  glutenFree: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: SortSchema.optional(),
});
export type FilterParams = z.infer<typeof FilterParamsSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  sortOrder: z.number().int(),
});
export type CategoryDTO = z.infer<typeof CategorySchema>;

export const VendorSchema = z.object({
  id: z.string(),
  shopName: z.string(),
  slug: z.string(),
  city: z.string(),
  rating: z.number(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
});
export type VendorDTO = z.infer<typeof VendorSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  categoryId: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  organic: z.boolean(),
  glutenFree: z.boolean(),
  rating: z.number().min(0).max(5),
});
export type ProductDTO = z.infer<typeof ProductSchema>;

export const CartItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().min(1).max(99),
});
export type CartItem = z.infer<typeof CartItemSchema>;

/** Order creation payload. Prices are NOT trusted from the client. */
export const OrderCreateSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
  addressId: z.string().min(1),
  discountCode: z.string().trim().max(32).optional(),
  useWallet: z.boolean().optional(),
  idempotencyKey: z.string().uuid(),
});
export type OrderCreateInput = z.infer<typeof OrderCreateSchema>;

export const MoneySchema = z.object({
  gross: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative(),
  walletApplied: z.number().int().nonnegative(),
  payable: z.number().int().nonnegative(),
});
export type Money = z.infer<typeof MoneySchema>;
