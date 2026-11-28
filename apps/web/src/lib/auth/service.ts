import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { normalizeIranianMobile } from "./validation";
import { getSessionStore, getUserStore, type UserRecord } from "./store";
import type { RegisterInput, SessionUser } from "@sabzineh/types";

/**
 * Auth service — token-based, no request scope.
 *
 * Cookie reading/writing lives in cookies.ts (dynamic next/headers
 * import, safe to import from unit tests). Everything here takes an
 * explicit token or input, so it is unit-testable without a request.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "invalid-credentials"
      | "email-taken"
      | "weak-password"
      | "invalid-phone"
      | "suspended",
  ) {
    super(code);
    this.name = "AuthError";
  }
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    vendorId: user.vendorId,
  };
}

/** Validates credentials and creates a session. Returns the token. */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{ user: SessionUser; token: string }> {
  const user = await getUserStore().findByEmail(email.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Identical error for unknown email and wrong password: no
    // account-enumeration oracle.
    throw new AuthError("invalid-credentials");
  }
  if (user.status !== "ACTIVE") throw new AuthError("suspended");
  const session = await getSessionStore().create(user.id, SESSION_TTL_MS);
  return { user: toSessionUser(user), token: session.token };
}

/** Registers a CUSTOMER. Vendor registration is a Week 5/6 concern. */
export async function registerCustomer(
  input: RegisterInput,
): Promise<{ user: SessionUser; token: string }> {
  const phone = normalizeIranianMobile(input.phone);
  if (!phone) throw new AuthError("invalid-phone");
  const passwordIssues = validatePasswordStrength(input.password);
  if (passwordIssues.length > 0) throw new AuthError("weak-password");
  const store = getUserStore();
  const existing = await store.findByEmail(input.email.trim().toLowerCase());
  if (existing) throw new AuthError("email-taken");
  const user = await store.create({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone,
    role: "CUSTOMER",
    passwordHash: await hashPassword(input.password),
  });
  const session = await getSessionStore().create(user.id, SESSION_TTL_MS);
  return { user: toSessionUser(user), token: session.token };
}

/** Invalidates one session token. */
export async function logout(token: string): Promise<void> {
  await getSessionStore().delete(token);
}

/** Resolves a session token to the signed-in user (null if expired/unknown). */
export async function getSessionUserFromToken(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await getSessionStore().get(token);
  if (!session) return null;
  const user = await getUserStore().findById(session.userId);
  if (!user || user.status !== "ACTIVE") return null;
  return toSessionUser(user);
}
