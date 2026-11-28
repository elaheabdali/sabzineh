import { hash, compare } from "bcryptjs";

/**
 * Password hashing (Week 3) — bcrypt, pure JS (no native build).
 *
 * The hash is the ONLY password material ever stored. Plaintext
 * passwords are never logged, never persisted, and never leave the
 * login/register server action. Demo accounts use "demo1234".
 */

export const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) return false;
  try {
    return await compare(password, passwordHash);
  } catch {
    // A malformed stored hash (e.g. the old Week 1 placeholder) must
    // fail closed — never crash login, never grant access.
    return false;
  }
}

/** Password strength rules (server-enforced at registration). */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordIssue {
  code: "too-short" | "no-letter" | "no-digit";
}

/** Returns every rule the password breaks (empty = strong enough). */
export function validatePasswordStrength(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push({ code: "too-short" });
  if (!/[A-Za-z\u0600-\u06FF]/.test(password)) issues.push({ code: "no-letter" });
  if (!/\d/.test(password)) issues.push({ code: "no-digit" });
  return issues;
}
