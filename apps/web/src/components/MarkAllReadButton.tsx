"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** Mark-all-read button for the notifications center page. */
export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      // The header bell keeps its own unread state — tell it to resync.
      window.dispatchEvent(new Event("sabzineh:notifications-changed"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="notifications-mark-all-read"
      onClick={markAll}
      disabled={busy}
      className="cursor-pointer rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
    >
      {t("markAllRead")}
    </button>
  );
}
