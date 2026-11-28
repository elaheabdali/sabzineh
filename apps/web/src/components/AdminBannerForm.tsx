"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Uploader, type UploadFileItem } from "@sabzineh/ui";
import { createBannerAction, updateBannerAction } from "@/server/admin/actions";
import type { BannerRecord } from "@/server/store";

/**
 * Admin banner form (Phase 3). The image comes from the shared
 * Uploader (drag-and-drop, previews, reorder) and is stored as a
 * data URL — the same storage approach as product images — or the
 * admin can paste an image URL instead. Edit mode posts every
 * field to the update action.
 */
export function AdminBannerForm({ banner }: { banner?: BannerRecord }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [busy, setBusy] = useState(false);

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsDataURL(file);
    });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      const uploaded = files.find((f) => !f.error);
      if (uploaded) {
        formData.set("imageUrl", await readAsDataUrl(uploaded.file));
      }
      if (banner) {
        formData.set("bannerId", banner.id);
        await updateBannerAction(formData);
      } else {
        await createBannerAction(formData);
      }
      setFiles([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" data-testid="admin-banner-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("bannerTitle")}
          <input name="title" required defaultValue={banner?.title ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("placement")}
          <select name="placement" defaultValue={banner?.placement ?? "HOME_STRIP"} className={inputClass}>
            <option value="HOME_HERO">HOME_HERO</option>
            <option value="HOME_STRIP">HOME_STRIP</option>
            <option value="CATEGORY">CATEGORY</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("linkUrl")}
          <input name="linkUrl" defaultValue={banner?.linkUrl ?? ""} className={inputClass} dir="ltr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("imageUrl")}
          <input
            name="imageUrl"
            defaultValue={banner?.imageUrl ?? ""}
            className={inputClass}
            dir="ltr"
            placeholder="https://…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("startsAt")}
          <input
            type="date"
            name="startsAt"
            defaultValue={banner?.startsAt ? banner.startsAt.toISOString().slice(0, 10) : ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("endsAt")}
          <input
            type="date"
            name="endsAt"
            defaultValue={banner?.endsAt ? banner.endsAt.toISOString().slice(0, 10) : ""}
            className={inputClass}
          />
        </label>
      </div>
      <Uploader files={files} onFilesChange={setFiles} maxFiles={1} label={t("bannerImage")} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} />
        {t("active")}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-fit cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {banner ? t("save") : t("createBanner")}
      </button>
    </form>
  );
}
