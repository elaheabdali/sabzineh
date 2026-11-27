import type { Role } from "@sabzineh/types";

/**
 * RBAC guards (Week 1 skeleton).
 *
 * Real sessions land in Week 3 (auth + roles). Until then `getSession`
 * returns null, so `requireRole` always denies protected panels —
 * fail-closed by design. The pure helpers (`hasAccess`,
 * `canAccessVendor`) are unit-tested now and reused by the real
 * session code later; nothing in the app trusts a client-side role.
 */

export interface Session {
  userId: string;
  email: string;
  role: Role;
  /** Set for vendors: the vendor profile this session may access. */
  vendorId?: string;
}

/** Week 3 replaces this with a real session lookup (cookie → DB). */
export async function getSession(): Promise<Session | null> {
  return null;
}

/** Pure role check — no I/O, safe to use in components and tests. */
export function hasAccess(session: Session | null, required: Role[]): boolean {
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  return required.includes(session.role);
}

/** A vendor may only touch rows of their own vendor profile. */
export function canAccessVendor(session: Session | null, vendorId: string): boolean {
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  return session.role === "VENDOR" && session.vendorId === vendorId;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Server-side guard for route groups and server actions.
 * Throws (the caller maps it to 401/403) — never redirects on a
 * client-supplied role.
 */
export async function requireRole(required: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  if (!hasAccess(session, required)) throw new ForbiddenError();
  return session;
}
