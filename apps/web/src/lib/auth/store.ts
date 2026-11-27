import type { PrismaClient } from "@prisma/client";
import type { Role } from "@sabzineh/types";
import { hashPassword } from "./password";
import { demoUsers } from "@/data/seed";
import { getPrismaClient } from "@/lib/prisma";

/**
 * Auth stores — one interface, two adapters (same pattern as the
 * catalog repository). Prisma when DATABASE_URL is set, otherwise an
 * in-memory store seeded from seed.json. Pages and actions NEVER
 * import an adapter directly; they call getUserStore() /
 * getSessionStore().
 *
 * The demo password is "demo1234" for all three demo accounts. In
 * memory mode the bcrypt hash is computed once per server process
 * and never leaves it; in Prisma mode seed.ts stores a real bcrypt
 * hash in the database.
 */

export const DEMO_PASSWORD = "demo1234";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  passwordHash: string;
  /** Set for vendors: the vendor profile this user may access. */
  vendorId: string | null;
}

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: {
    email: string;
    name: string;
    phone: string | null;
    role: Role;
    passwordHash: string;
  }): Promise<UserRecord>;
  listAll(): Promise<UserRecord[]>;
  getVendorIdByUserId(userId: string): Promise<string | null>;
}

export interface SessionStore {
  create(userId: string, ttlMs: number): Promise<SessionRecord>;
  get(token: string): Promise<SessionRecord | null>;
  delete(token: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prisma adapters
// ---------------------------------------------------------------------------

function toUserRecord(
  u: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: Role;
    status: "ACTIVE" | "SUSPENDED";
    passwordHash: string;
  },
  vendorId: string | null,
): UserRecord {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    status: u.status,
    passwordHash: u.passwordHash,
    vendorId,
  };
}

export class PrismaUserStore implements UserStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { vendorProfile: { select: { id: true } } },
    });
    if (!user) return null;
    return toUserRecord(user, user.vendorProfile?.id ?? null);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { vendorProfile: { select: { id: true } } },
    });
    if (!user) return null;
    return toUserRecord(user, user.vendorProfile?.id ?? null);
  }

  async create(input: {
    email: string;
    name: string;
    phone: string | null;
    role: Role;
    passwordHash: string;
  }): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: input.role,
        passwordHash: input.passwordHash,
      },
    });
    return toUserRecord(user, null);
  }

  async listAll(): Promise<UserRecord[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { vendorProfile: { select: { id: true } } },
    });
    return users.map((u) => toUserRecord(u, u.vendorProfile?.id ?? null));
  }

  async getVendorIdByUserId(userId: string): Promise<string | null> {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }
}

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, ttlMs: number): Promise<SessionRecord> {
    const token = crypto.randomUUID();
    const session = await this.prisma.session.create({
      data: { id: token, userId, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return { token: session.id, userId: session.userId, expiresAt: session.expiresAt };
  }

  async get(token: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({ where: { id: token } });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: token } }).catch(() => undefined);
      return null;
    }
    return { token: session.id, userId: session.userId, expiresAt: session.expiresAt };
  }

  async delete(token: string): Promise<void> {
    await this.prisma.session.delete({ where: { id: token } }).catch(() => undefined);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

// ---------------------------------------------------------------------------
// Memory adapters (no database — demo + tests)
// ---------------------------------------------------------------------------

const DEMO_USER_IDS: Record<string, string> = {
  "admin@sabzineh.ir": "u-admin",
  "vendor@sabzineh.ir": "u-vendor",
  "customer@sabzineh.ir": "u-customer",
};

export class MemoryUserStore implements UserStore {
  private users = new Map<string, UserRecord>();
  private seeded: Promise<void> | null = null;

  /** Hashes the demo password once per process; never stored in code. */
  private ensureSeeded(): Promise<void> {
    this.seeded ??= (async () => {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      for (const demo of demoUsers) {
        const id = DEMO_USER_IDS[demo.email] ?? `u-${demo.email}`;
        this.users.set(id, {
          id,
          email: demo.email,
          name: demo.name,
          phone: null,
          role: demo.role as Role,
          status: "ACTIVE",
          passwordHash,
          vendorId: demo.vendorId,
        });
      }
    })();
    return this.seeded;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    await this.ensureSeeded();
    const wanted = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === wanted) return { ...user };
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    await this.ensureSeeded();
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async create(input: {
    email: string;
    name: string;
    phone: string | null;
    role: Role;
    passwordHash: string;
  }): Promise<UserRecord> {
    await this.ensureSeeded();
    const record: UserRecord = {
      id: `u-${crypto.randomUUID()}`,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role,
      status: "ACTIVE",
      passwordHash: input.passwordHash,
      vendorId: null,
    };
    this.users.set(record.id, record);
    return { ...record };
  }

  async listAll(): Promise<UserRecord[]> {
    await this.ensureSeeded();
    return [...this.users.values()].map((u) => ({ ...u }));
  }

  async getVendorIdByUserId(userId: string): Promise<string | null> {
    await this.ensureSeeded();
    return this.users.get(userId)?.vendorId ?? null;
  }
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionRecord>();

  async create(userId: string, ttlMs: number): Promise<SessionRecord> {
    const record: SessionRecord = {
      token: crypto.randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    };
    this.sessions.set(record.token, record);
    return { ...record };
  }

  async get(token: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return { ...session };
  }

  async delete(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(token);
    }
  }
}

// ---------------------------------------------------------------------------
// Factories — the only entry points the app uses
// ---------------------------------------------------------------------------

const globalForAuthStores = globalThis as unknown as {
  userStore?: UserStore;
  sessionStore?: SessionStore;
};

/** Prisma when DATABASE_URL is set, otherwise the memory adapter. */
export function getUserStore(): UserStore {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaUserStore(prisma);
  globalForAuthStores.userStore ??= new MemoryUserStore();
  return globalForAuthStores.userStore;
}

/** Prisma when DATABASE_URL is set, otherwise the memory adapter. */
export function getSessionStore(): SessionStore {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaSessionStore(prisma);
  globalForAuthStores.sessionStore ??= new MemorySessionStore();
  return globalForAuthStores.sessionStore;
}

/** Which adapter is active — shown in README/docs, never a secret. */
export function getAuthDataSource(): "prisma" | "memory" {
  return getPrismaClient() ? "prisma" : "memory";
}
