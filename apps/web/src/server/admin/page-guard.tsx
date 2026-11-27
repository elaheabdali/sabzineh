import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
  type Session,
} from "@/lib/auth/guards";
import type { Locale } from "@/i18n/routing";

/**
 * Admin page guard (Week 6) — the same requireRole + redirect /
 * forbidden handling every admin page used to repeat inline.
 * Returns the session, or a renderable element for the forbidden
 * case (unauthorized redirects — redirect() throws).
 */
export async function adminGuard(
  locale: Locale,
  next: string,
): Promise<{ session: Session } | { element: ReactNode }> {
  try {
    const session = await requireRole(["ADMIN"]);
    return { session };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=${next}`);
    }
    if (error instanceof ForbiddenError) {
      const t = await getTranslations("account");
      return {
        element: (
          <div className="flex flex-col gap-4 pt-8" data-testid="admin-forbidden">
            <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
            <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
          </div>
        ),
      };
    }
    throw error;
  }
}
