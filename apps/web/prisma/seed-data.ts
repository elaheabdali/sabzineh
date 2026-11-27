/**
 * Typed re-export of the seed JSON — the single source of truth.
 * The storefront reads the same file, so the app renders identically
 * with or without a database.
 */
import seed from "../src/data/seed.json";

export type SeedCategory = (typeof seed.categories)[number];
export type SeedVendor = (typeof seed.vendors)[number];
export type SeedProduct = (typeof seed.products)[number];
export type SeedPlan = (typeof seed.plans)[number];
export type SeedDiscount = (typeof seed.discounts)[number];
export type SeedBanner = (typeof seed.banners)[number];
export type SeedDemoUser = (typeof seed.demoUsers)[number];

export const seedData = seed;
