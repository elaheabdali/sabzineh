import type { Role, SessionUser } from "@sabzineh/types";
import { getSessionUserFromToken } from "./service";
import { readSessionToken } from "./cookies";

/**
 * RBAC guards — now backed by real sessions (Week 3).
 *
 * getSession() reads the httpOnly session cookie and resolves it
 * server-side (cookie → session record → user). It never trusts a
 * client-supplied role: the role comes from the user record.
 * Outside a request (unit tests) the cookie read resolves to null —
 * fail-closed by design.
 */

export type Session = SessionUser;

export async function getSession(): Promise<Session | null> {
  const token = await readSessionToken();
  return getSessionUserFromToken(token);
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

/** Any signed-in user, regardless of role. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * Page-level guard: pages call this instead of try/catching
 * requireRole themselves. Returns the session, or `{ forbidden: true }`
 * when the user is signed in with the wrong role. Callers redirect
 * to login on UnauthorizedError.
 */
export async function authorizePage(
  required: Role[],
): Promise<{ session: Session } | { forbidden: true }> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  if (!hasAccess(session, required)) return { forbidden: true };
  return { session };
}
