import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale routing (Next.js 16: `src/proxy.ts`, not `middleware.ts`).
 * `/` → `/fa` redirects and `fa` | `en` prefix validation.
 * API routes and the payment callback bypass the locale middleware.
 */
export const proxy = createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
