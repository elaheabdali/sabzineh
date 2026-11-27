import { PrismaClient } from "@prisma/client";

/**
 * Lazy Prisma client singleton.
 *
 * Returns null when DATABASE_URL is not set (no Neon database yet) —
 * the catalog factory then uses the seed adapter instead, so the app
 * still renders. Never construct the client without a URL: Prisma
 * validates the datasource at construction time.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}

/** True once a real database is configured (Neon DATABASE_URL). */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
