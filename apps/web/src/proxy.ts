import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE } from "./lib/auth/cookies";

/**
 * Locale routing (Next.js 16: `src/proxy.ts`, not `middleware.ts`).
 * `/` → `/fa` redirects and `fa` | `en` prefix validation.
 * API routes and the payment callback bypass the locale middleware.
 *
 * Auth (Week 3): protected route groups (/account, /vendor, /admin)
 * redirect guests to login when the session cookie is absent. This
 * is a fast-path only — full validation stays in the page guards
 * (lib/auth/guards), which resolve the cookie server-side and fail
 * closed on an invalid/expired session.
 */
const intlMiddleware = createMiddleware(routing);

const PROTECTED = /^\/(fa|en)\/(account|vendor|admin)(\/|$)/;

export function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  const { pathname } = request.nextUrl;
  if (PROTECTED.test(pathname) && !request.cookies.get(SESSION_COOKIE)?.value) {
    const locale = pathname.split("/")[1] ?? "fa";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
