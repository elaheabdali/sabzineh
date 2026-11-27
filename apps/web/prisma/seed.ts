/**
 * Prisma seed. Requires DATABASE_URL (Neon) — run `pnpm db:seed`.
 *
 * Demo accounts use password "demo1234" for all three roles, hashed
 * with bcrypt at seed time (Week 3). Never ship a demo password to
 * production.
 */
import { hashSync } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { seedData } from "./seed-data";

const prisma = new PrismaClient();

// Deterministic SVG placeholder per product (no external images).
function placeholderImage(title: string): string {
  const initial = title.trim().charAt(0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#dcead8"/><text x="400" y="440" font-size="280" text-anchor="middle" fill="#265423" font-family="sans-serif">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Real bcrypt hash of the demo password, computed at seed time. */
const DEMO_PASSWORD_HASH = hashSync("demo1234", 10);

async function main() {
  // Vendors + demo users first (products reference vendors).
  for (const vendor of seedData.vendors) {
    const demoUser = seedData.demoUsers.find((u) => u.vendorId === vendor.id);
    const user = await prisma.user.upsert({
      where: { email: demoUser ? demoUser.email : `${vendor.slug}@vendors.sabzineh.ir` },
      update: {},
      create: {
        email: demoUser ? demoUser.email : `${vendor.slug}@vendors.sabzineh.ir`,
        name: demoUser ? demoUser.name : vendor.shopName,
        role: demoUser ? (demoUser.role as "VENDOR") : "VENDOR",
        passwordHash: DEMO_PASSWORD_HASH,
      },
    });
    await prisma.vendorProfile.upsert({
      where: { slug: vendor.slug },
      update: { shopName: vendor.shopName, city: vendor.city, rating: vendor.rating, status: "APPROVED" },
      create: {
        id: vendor.id,
        userId: user.id,
        shopName: vendor.shopName,
        slug: vendor.slug,
        city: vendor.city,
        rating: vendor.rating,
        status: "APPROVED",
      },
    });
  }

  for (const category of seedData.categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { nameFa: category.nameFa, nameEn: category.nameEn, sortOrder: category.sortOrder },
      create: {
        id: category.id,
        parentId: category.parentId,
        slug: category.slug,
        nameFa: category.nameFa,
        nameEn: category.nameEn,
        sortOrder: category.sortOrder,
      },
    });
  }

  for (const product of seedData.products) {
    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { price: product.price, stock: product.stock, rating: product.rating, local: product.local },
      create: {
        id: product.id,
        vendorId: product.vendorId,
        categoryId: product.categoryId,
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: product.stock,
        status: "PUBLISHED",
        organic: product.organic,
        glutenFree: product.glutenFree,
        local: product.local,
        rating: product.rating,
      },
    });
    await prisma.productImage.upsert({
      where: { id: `${product.id}-img` },
      update: {},
      create: {
        id: `${product.id}-img`,
        productId: created.id,
        url: placeholderImage(product.title),
        alt: product.title,
        sortOrder: 0,
      },
    });
  }

  for (const plan of seedData.plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: { price: plan.price },
      create: {
        id: plan.id,
        kind: plan.kind as "BOX" | "VENDOR",
        title: plan.title,
        price: plan.price,
        periodDays: plan.periodDays,
        features: plan.features,
      },
    });
  }

  for (const discount of seedData.discounts) {
    await prisma.discount.upsert({
      where: { code: discount.code },
      update: {},
      create: {
        code: discount.code,
        type: discount.type as "PERCENT" | "FIXED",
        value: discount.value,
        minAmount: discount.minAmount,
        usageLimit: discount.usageLimit,
      },
    });
  }

  for (const banner of seedData.banners) {
    await prisma.banner.upsert({
      where: { id: banner.id },
      update: { title: banner.title, active: banner.active },
      create: {
        id: banner.id,
        title: banner.title,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        placement: banner.placement as "HOME_HERO" | "HOME_STRIP",
        active: banner.active,
      },
    });
  }

  // Demo admin + customer accounts (vendor account was created above).
  for (const demoUser of seedData.demoUsers.filter((u) => u.role !== "VENDOR")) {
    await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: {
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role as "ADMIN" | "CUSTOMER",
        passwordHash: DEMO_PASSWORD_HASH,
      },
    });
  }

  // Seeded wallet + active weekly box subscription for the demo customer.
  const customer = await prisma.user.findUnique({ where: { email: "customer@sabzineh.ir" } });
  if (customer) {
    await prisma.wallet.upsert({
      where: { userId: customer.id },
      update: {},
      create: { userId: customer.id, balance: 150000 },
    });
    const boxPlan = await prisma.plan.findUnique({ where: { id: "plan-box-weekly" } });
    if (boxPlan) {
      await prisma.subscription.upsert({
        where: { id: "seed-customer-box" },
        update: {},
        create: {
          id: "seed-customer-box",
          userId: customer.id,
          planId: boxPlan.id,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          autoRenew: true,
        },
      });
    }
  }

  console.log(
    `Seeded ${seedData.categories.length} categories, ${seedData.vendors.length} vendors, ${seedData.products.length} products.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
