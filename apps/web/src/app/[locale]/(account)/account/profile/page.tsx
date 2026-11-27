import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { logoutAction } from "@/server/auth/actions";
import { Button } from "@sabzineh/ui";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** Profile — real user from the session, wallet balance, logout. */
export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/profile`);
  const t = await getTranslations("account");
  const tAuth = await getTranslations("auth");
  const walletBalance = await getDataStore().getWalletBalance(session.id);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="profile-page">
      <h1 className="text-2xl font-black text-ink-900">{t("profile")}</h1>
      <section className="rounded-2xl border border-cream-200 bg-white p-6">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">{tAuth("name")}</dt>
            <dd className="font-bold text-ink-900" data-testid="profile-name">{session.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{tAuth("email")}</dt>
            <dd className="font-bold text-ink-900" data-testid="profile-email">{session.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("walletBalance")}</dt>
            <dd className="font-bold text-ink-900" data-testid="profile-wallet">
              {formatPrice(walletBalance, locale)}
            </dd>
          </div>
        </dl>
      </section>
      <form action={logoutAction} className="flex">
        <Button type="submit" variant="outline" data-testid="logout-button">
          {tAuth("logout")}
        </Button>
      </form>
    </div>
  );
}
