import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("common");
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-neutral-500">{t("error")}</p>
      <Link href="/" className="mt-6 inline-block text-leaf-700 underline">
        {t("back")}
      </Link>
    </div>
  );
}
