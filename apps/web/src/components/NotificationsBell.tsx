"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatJalali } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  "order-status": "orderStatus",
  "order-paid": "orderPaid",
  "box-generated": "boxGenerated",
  "vendor-approved": "vendorApproved",
  "vendor-rejected": "vendorRejected",
  "payout-status": "payoutStatus",
};

/**
 * Notifications bell (Week 7).
 *
 * Live path: EventSource to /api/events (session cookie, same origin).
 * Fallback: polling GET /api/notifications with backoff when SSE
 * errors or is unavailable. The notification rows are the source of
 * truth in both paths, so a dropped SSE connection loses nothing.
 * Only rendered for logged-in users (Header gates on sessionUser).
 */
export function NotificationsBell({ locale }: { locale: Locale }) {
  const t = useTranslations("notifications");
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationItem[]; unread: number };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // Offline: the bell keeps its last state.
    }
  }, []);

  useEffect(() => {
    let stopped = false;

    const source = new EventSource("/api/events");
    let backoffMs = 30000;
    source.addEventListener("hello", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { unread?: number };
        if (typeof data.unread === "number") setUnread(data.unread);
      } catch {
        // Ignore malformed hello payloads.
      }
      // The hello event is the connect handshake: load the list here
      // (an event handler, not the effect body) instead of fetching
      // synchronously inside the effect.
      if (!stopped) void refresh();
    });
    const onEvent = () => {
      if (!stopped) void refresh();
    };
    source.addEventListener("order-status", onEvent);
    source.addEventListener("order-paid", onEvent);
    source.addEventListener("box-generated", onEvent);
    source.addEventListener("vendor-approved", onEvent);
    source.addEventListener("vendor-rejected", onEvent);
    source.addEventListener("payout-status", onEvent);
    // The notifications page marks things read without an SSE event:
    // listen for its broadcast so the badge resyncs immediately.
    const onChanged = () => {
      if (!stopped) void refresh();
    };
    window.addEventListener("sabzineh:notifications-changed", onChanged);
    source.onerror = () => {
      // SSE dropped: close it and poll instead, backing off to 2 min.
      source.close();
      const tick = () => {
        if (stopped) return;
        void refresh();
        backoffMs = Math.min(backoffMs * 2, 120000);
        pollTimer.current = setTimeout(tick, backoffMs);
      };
      pollTimer.current = setTimeout(tick, backoffMs);
    };

    return () => {
      stopped = true;
      source.close();
      window.removeEventListener("sabzineh:notifications-changed", onChanged);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refresh]);

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number };
      setUnread(data.unread);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch {
      // Leave the list as-is on network failure.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("title")}
        aria-expanded={open}
        data-testid="notifications-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer rounded-lg p-2 hover:bg-cream-100"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            data-testid="notifications-count"
            className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white"
          >
            {unread.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          data-testid="notifications-list"
          className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-cream-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-ink-900">{t("title")}</h2>
            {unread > 0 ? (
              <button
                type="button"
                data-testid="notifications-mark-all-read"
                onClick={markAllRead}
                className="cursor-pointer text-xs font-medium text-leaf-700 hover:underline"
              >
                {t("markAllRead")}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">{t("empty")}</p>
          ) : (
            <ul className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  data-testid="notification-item"
                  data-type={item.type}
                  data-read={item.readAt !== null}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    item.readAt ? "border-cream-200 bg-white" : "border-leaf-200 bg-leaf-100/50"
                  }`}
                >
                  <p className="font-bold text-ink-900">
                    {t(TYPE_LABEL[item.type] ?? "title")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    {typeof item.payload.orderId === "string"
                      ? item.payload.orderId.slice(0, 8)
                      : typeof item.payload.shopName === "string"
                        ? item.payload.shopName
                        : ""}
                    {typeof item.payload.status === "string" ? ` — ${item.payload.status}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400">{formatJalali(item.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="mt-3 block text-center text-xs font-medium text-leaf-700 hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
