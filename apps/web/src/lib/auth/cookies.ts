/**
 * Session cookie helpers.
 *
 * next/headers is imported dynamically inside try/catch so this module
 * stays importable from unit tests (no request scope there): outside a
 * request the helpers resolve to null / no-op instead of throwing.
 * The cookie is httpOnly, sameSite=lax, secure in production, and the
 * token itself is an opaque random UUID stored server-side.
 */

export const SESSION_COOKIE = "sabzineh-session";

export async function readSessionToken(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, maxAgeSeconds: number): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });
  } catch {
    // Outside a request (tests) there is no cookie jar — no-op.
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    (await cookies()).delete(SESSION_COOKIE);
  } catch {
    // Outside a request (tests) there is no cookie jar — no-op.
  }
}
