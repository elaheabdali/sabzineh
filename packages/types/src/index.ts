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
  /** Uploaded image URLs (data: URLs in demo mode). Absent = placeholder gallery. */
  images: z.array(z.string()).optional(),
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

// ---------------------------------------------------------------------------
// Vendor panel (Week 5) — multi-step product form, profile, registration.
// One schema validates a step on the client and the payload on the
// server; the combined input is what the server action receives.
// ---------------------------------------------------------------------------

/** Step 1 — basics. Prices are integer Toman; min 1,000 keeps typos out. */
const VendorProductStep1Shape = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  categoryId: z.string().min(1),
  price: z.number().int().min(1000).max(100_000_000),
  compareAtPrice: z.number().int().min(1000).max(100_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(100_000),
};

const compareAtPriceRefine = {
  check: (v: { price: number; compareAtPrice?: number | null }) =>
    v.compareAtPrice == null || v.compareAtPrice > v.price,
  params: { path: ["compareAtPrice"], message: "compareAtPrice must exceed price" },
};

export const VendorProductStep1Schema = z
  .object(VendorProductStep1Shape)
  .refine(compareAtPriceRefine.check, compareAtPriceRefine.params);
export type VendorProductStep1 = z.infer<typeof VendorProductStep1Schema>;

/** One uploaded image: a data: URL (demo) or https URL, with alt text. */
export const VendorProductImageSchema = z.object({
  url: z
    .string()
    .min(1)
    .max(3_000_000)
    .refine(
      (u) =>
        u.startsWith("data:image/") ||
        /^https:\/\/[^?#]+\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(u),
      { message: "image must be a data: image URL or https image URL" },
    ),
  alt: z.string().trim().max(120),
});
export type VendorProductImage = z.infer<typeof VendorProductImageSchema>;

/** Step 2 — images. Zero is allowed (placeholder gallery); max 4. */
export const VendorProductStep2Schema = z.object({
  images: z.array(VendorProductImageSchema).max(4),
});
export type VendorProductStep2 = z.infer<typeof VendorProductStep2Schema>;

/** Step 3 — attributes, tags and tasting/origin notes. */
const VendorProductStep3Shape = {
  organic: z.boolean(),
  glutenFree: z.boolean(),
  local: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  originNote: z.string().trim().max(300).optional(),
};

export const VendorProductStep3Schema = z.object(VendorProductStep3Shape);
export type VendorProductStep3 = z.infer<typeof VendorProductStep3Schema>;

/** The full product payload the server action receives. */
export const VendorProductInputSchema = z
  .object({
    ...VendorProductStep1Shape,
    images: z.array(VendorProductImageSchema).max(4),
    ...VendorProductStep3Shape,
  })
  .refine(compareAtPriceRefine.check, compareAtPriceRefine.params);
export type VendorProductInput = z.infer<typeof VendorProductInputSchema>;

export const VendorProductStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type VendorProductStatus = z.infer<typeof VendorProductStatusSchema>;

/** Vendor profile — public fields + payout fields (never shown publicly). */
export const VendorProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  shopName: z.string(),
  slug: z.string(),
  city: z.string(),
  bio: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
  rating: z.number(),
  phone: z.string().nullable(),
  logoUrl: z.string().nullable(),
  payoutIban: z.string().nullable(),
  payoutAccountHolder: z.string().nullable(),
});
export type VendorProfileDTO = z.infer<typeof VendorProfileSchema>;

/** Iranian IBAN (Sheba): IR + 24 digits, spaces stripped before check. */
export const IbanSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().regex(/^IR[0-9]{24}$/));

export const VendorProfileUpdateSchema = z.object({
  shopName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).optional(),
  phone: z.string().trim().min(10).max(15).optional(),
  logoUrl: z
    .string()
    .max(3_000_000)
    .refine((u) => u === "" || u.startsWith("data:image/") || u.startsWith("https://"))
    .optional(),
  payoutIban: IbanSchema.optional(),
  payoutAccountHolder: z.string().trim().max(80).optional(),
});
export type VendorProfileUpdate = z.infer<typeof VendorProfileUpdateSchema>;

/** Vendor registration request — creates a VENDOR user + PENDING profile. */
export const VendorRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(10).max(15),
  password: z.string().min(8).max(128),
  shopName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).optional(),
  documentsNote: z.string().trim().max(500).optional(),
});
export type VendorRegistrationInput = z.infer<typeof VendorRegistrationSchema>;

/** Vendor order fulfilment: PAID → PREPARING → SHIPPED → DELIVERED. */
export const VendorOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.enum(["PREPARING", "SHIPPED", "DELIVERED"]),
});
export type VendorOrderStatus = z.infer<typeof VendorOrderStatusSchema>;
