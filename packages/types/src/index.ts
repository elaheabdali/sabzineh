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
  local: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: SortSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
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
  local: z.boolean(),
  rating: z.number().min(0).max(5),
});
export type ProductDTO = z.infer<typeof ProductSchema>;

/** A catalog review. Seed reviews are deterministic demo data
 *  (features/catalog/reviews.ts); real reviews come from the DB. */
export const ReviewSchema = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().min(1).max(5),
  text: z.string(),
  createdAt: z.string(),
});
export type ReviewDTO = z.infer<typeof ReviewSchema>;

/** One page of catalog results (both repository implementations). */
export const CatalogListResultSchema = z.object({
  items: z.array(ProductSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1),
});
export type CatalogListResult = z.infer<typeof CatalogListResultSchema>;

/** Facet counts for the filter sidebar. Each count is computed on the
 *  result set with that facet's own filter removed (standard faceted
 *  search), so counts never drop to zero because of the facet itself. */
export const FacetCountsSchema = z.object({
  categories: z.array(z.object({ id: z.string(), count: z.number().int().nonnegative() })),
  vendors: z.array(z.object({ id: z.string(), count: z.number().int().nonnegative() })),
  attributes: z.object({
    organic: z.number().int().nonnegative(),
    glutenFree: z.number().int().nonnegative(),
    local: z.number().int().nonnegative(),
    inStock: z.number().int().nonnegative(),
  }),
  price: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }),
});
export type FacetCounts = z.infer<typeof FacetCountsSchema>;

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

// ---------------------------------------------------------------------------
// Auth (Week 3) — one schema validates the form on the client and the
// payload on the server. Password rules live in lib/auth/password.ts
// (same constants, enforced server-side); the schema only checks shape.
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  /** Iranian mobile, 09xxxxxxxxx or +989xxxxxxxxx (normalised server-side). */
  phone: z.string().trim().min(10).max(15),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

/** The public shape of a signed-in user — never includes a password hash. */
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  vendorId: z.string().nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

// ---------------------------------------------------------------------------
// Addresses (Week 3)
// ---------------------------------------------------------------------------

export const AddressSchema = z.object({
  title: z.string().trim().min(2).max(40),
  city: z.string().trim().min(2).max(60),
  text: z.string().trim().min(10).max(300),
  /** Exactly 10 digits (Persian digits are normalised server-side). */
  postalCode: z.string().trim().min(10).max(10),
  phone: z.string().trim().min(10).max(15),
});
export type AddressInput = z.infer<typeof AddressSchema>;

export const AddressDTOSchema = AddressSchema.extend({
  id: z.string(),
  userId: z.string(),
});
export type AddressDTO = z.infer<typeof AddressDTOSchema>;
