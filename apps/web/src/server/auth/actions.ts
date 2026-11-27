"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/lib/auth/cookies";
import {
  AuthError,
  SESSION_TTL_MS,
  loginWithCredentials,
  logout,
  registerCustomer,
} from "@/lib/auth/service";
import { LoginSchema, RegisterSchema } from "@sabzineh/types";

/**
 * Auth server actions (Week 3).
 *
 * Login/register set the httpOnly session cookie and redirect; the
 * cart is device-local (Zustand + persist) and survives login — the
 * login form merges the pre-login guest lines client-side
 * (stores/cart.mergeGuestCart) so nothing is lost on sign-in.
 * Logout invalidates the session server-side, not just the cookie.
 */

export interface AuthActionState {
  error?: string;
}

/** Only same-origin locale paths may be used as a post-login target. */
function safeNext(raw: string | null): string {
  if (raw && /^\/(fa|en)(\/|$)/.test(raw)) return raw;
  return "/fa";
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid-credentials" };
  const next = safeNext(
    typeof formData.get("next") === "string" ? (formData.get("next") as string) : null,
  );
  try {
    const { token } = await loginWithCredentials(parsed.data.email, parsed.data.password);
    await setSessionCookie(token, SESSION_TTL_MS / 1000);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.code };
    return { error: "unknown" };
  }
  redirect(next);
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid-input" };
  const next = safeNext(
    typeof formData.get("next") === "string" ? (formData.get("next") as string) : null,
  );
  try {
    const { token } = await registerCustomer(parsed.data);
    await setSessionCookie(token, SESSION_TTL_MS / 1000);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.code };
    return { error: "unknown" };
  }
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  redirect("/fa");
}
