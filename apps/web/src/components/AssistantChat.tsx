"use client";

import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

interface AssistantProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  products?: AssistantProduct[];
  orderId?: string;
  needsLogin?: boolean;
}

/**
 * Shopping assistant panel (Week 7).
 *
 * A floating button opens a chat panel; messages go to POST
 * /api/assistant, which answers from real store data with fixed
 * rules — no AI model, no fake "typing" indicator. Product answers
 * link to the real product pages; order-status answers link to the
 * order. Guests can ask product/FAQ questions; order status needs
 * a login (the API says so honestly).
 */
export function AssistantChat({ locale }: { locale: Locale }) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text }]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale }),
      });
      const data = (await res.json()) as {
        reply?: string;
        products?: AssistantProduct[];
        orderId?: string;
        needsLogin?: boolean;
      };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "",
          products: data.products,
          orderId: data.orderId,
          needsLogin: data.needsLogin,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: locale === "fa" ? "خطا در ارتباط؛ دوباره امتحان کنید." : "Connection error; please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div
          data-testid="assistant-panel"
          className="flex h-[480px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between bg-leaf-700 px-4 py-3 text-white">
            <h2 className="text-sm font-black">{t("title")}</h2>
            <button
              type="button"
              aria-label={t("close")}
              data-testid="assistant-close"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-lg p-1 hover:bg-leaf-600"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div data-testid="assistant-messages" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-sm leading-7 text-neutral-600">{t("hint")}</p>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={index}
                data-testid="assistant-message"
                data-role={message.role}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${
                  message.role === "user"
                    ? "self-start bg-leaf-700 text-white"
                    : "self-end bg-cream-100 text-ink-900"
                }`}
              >
                <p className="whitespace-pre-line" data-testid="assistant-reply">
                  {message.text}
                </p>
                {message.products && message.products.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {message.products.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={`/product/${product.slug}`}
                          className="font-bold text-leaf-700 hover:underline"
                          data-testid="assistant-product-link"
                        >
                          {product.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.orderId ? (
                  <Link
                    href={`/account/orders/${message.orderId}`}
                    className="mt-2 block font-bold text-leaf-700 hover:underline"
                  >
                    {t("viewOrder")}
                  </Link>
                ) : null}
                {message.needsLogin ? (
                  <Link href="/auth/login" className="mt-2 block font-bold text-leaf-700 hover:underline">
                    {locale === "fa" ? "ورود" : "Sign in"}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-cream-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              data-testid="assistant-input"
              className="min-w-0 flex-1 rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-600"
            />
            <button
              type="button"
              aria-label={t("send")}
              data-testid="assistant-send"
              onClick={() => void send()}
              disabled={sending || input.trim().length === 0}
              className="cursor-pointer rounded-xl bg-leaf-700 px-3 py-2 text-white disabled:opacity-50"
            >
              <Send className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={open ? t("close") : t("open")}
        data-testid="assistant-toggle"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded-full bg-leaf-700 p-4 text-white shadow-lg hover:bg-leaf-600"
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </button>
    </div>
  );
}
