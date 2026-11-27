import { normalizeFa } from "@/features/catalog/smart-search";

/**
 * Shopping assistant (Week 7) — rule-based intent routing over fixed
 * keyword lists. NO AI API is called and NO model runs: the reply is
 * assembled from real catalog / order / plan data by the API route,
 * or from the FAQ table below. When no rule matches, the assistant
 * says so and hands off to human support — it never invents an answer.
 */

export type AssistantIntent =
  | "order-status"
  | "product-search"
  | "subscription"
  | "faq-payment"
  | "faq-shipping"
  | "faq-discount"
  | "greeting"
  | "unknown";

export interface RoutedMessage {
  intent: AssistantIntent;
  /** The leftover text after intent keywords, used as a product query. */
  query: string;
}

const INTENT_KEYWORDS: { intent: AssistantIntent; keywords: string[] }[] = [
  {
    intent: "order-status",
    keywords: ["سفارش", "پیگیری", "کجاست", "وضعیت سفارش", "سفارش من", "رسید", "order"],
  },
  {
    intent: "subscription",
    keywords: ["اشتراک", "باکس", "پلن", "عضویت", "هفتگی", "subscription", "box"],
  },
  {
    intent: "faq-payment",
    keywords: ["پرداخت", "زرین‌پال", "زرینپال", "کیف پول", "کارت", "پرداخت کنم", "payment", "zarinpal"],
  },
  {
    intent: "faq-shipping",
    keywords: ["ارسال", "تحویل", "پست", "چقدر طول", "کی میرسه", "کی می‌رسد", "هزینه ارسال", "shipping", "delivery"],
  },
  {
    intent: "faq-discount",
    keywords: ["تخفیف", "کد تخفیف", "کوپن", "discount", "coupon"],
  },
  {
    intent: "greeting",
    keywords: ["سلام", "درود", "صبح بخیر", "عصر بخیر", "hello", "hi"],
  },
  {
    intent: "product-search",
    keywords: ["پیشنهاد", "چی بخرم", "چی داری", "چی داری؟", "برای صبحانه", "برای ناهار", "دنبال", "می‌خوام", "میخوام", "می‌خواهم", "بخرم"],
  },
];

/** Route a message to an intent. Pure: no I/O, no AI call. */
export function routeAssistantMessage(text: string): RoutedMessage {
  const norm = normalizeFa(text);
  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (keywords.some((k) => norm.includes(normalizeFa(k)))) {
      return { intent, query: text.trim() };
    }
  }
  // No keyword matched: if the text looks like a product name (2+ chars,
  // no question words), treat it as a product search; otherwise unknown.
  const trimmed = text.trim();
  if (trimmed.length >= 2) return { intent: "product-search", query: trimmed };
  return { intent: "unknown", query: trimmed };
}

/** FAQ answers (fa). The route renders the matching entry. */
export const FAQ_FA: Record<Exclude<AssistantIntent, "order-status" | "product-search" | "subscription" | "greeting" | "unknown">, string> = {
  "faq-payment":
    "پرداخت در سبزینه با زرین‌پال (سندباکس در نسخه نمایشی) یا از کیف پول انجام می‌شود. می‌توانید بخشی از مبلغ را از کیف پول و بقیه را با درگاه بپردازید؛ سفارش لغوشده به کیف پول برمی‌گردد.",
  "faq-shipping":
    "سفارش‌ها را هر فروشنده جدا ارسال می‌کند و هزینه ارسال در مرحله تسویه مشخص است. وضعیت سفارش (آماده‌سازی، ارسال، تحویل) را می‌توانید در «سفارش‌های من» ببینید.",
  "faq-discount":
    "کد تخفیف را در مرحله پرداخت وارد کنید؛ کد از نظر سقف استفاده، حداقل مبلغ و تاریخ انقضا سمت سرور بررسی می‌شود و برای هر کاربر فقط یک بار قابل استفاده است.",
};

export const FAQ_EN: Record<keyof typeof FAQ_FA, string> = {
  "faq-payment":
    "Payment in Sabzineh is by Zarinpal (sandbox in the demo) or from your wallet. You can pay part from the wallet and the rest through the gateway; a cancelled order is refunded to the wallet.",
  "faq-shipping":
    "Each vendor ships their own items and the delivery fee is shown at checkout. You can track an order (preparing, shipped, delivered) under “My orders”.",
  "faq-discount":
    "Enter a discount code at the payment step; it is validated server-side for usage cap, minimum amount and expiry, and each user can use it once.",
};

export const ASSISTANT_HANDOFF_FA =
  "برای این سؤال پاسخی در اطلاعات فروشگاه پیدا نکردم. لطفاً به پشتیبانی پیام بدهید تا راهنمایی‌تان کنیم.";
export const ASSISTANT_HANDOFF_EN =
  "I could not find an answer to that in the store information. Please message support and we will help you.";

export const ASSISTANT_GREETING_FA =
  "سلام! می‌توانم محصول پیشنهاد بدهم، اشتراک باکس را توضیح بدهم یا وضعیت سفارشت را بگویم. چه کمکی از دستم برمی‌آید؟";
export const ASSISTANT_GREETING_EN =
  "Hello! I can suggest products, explain the box subscription, or check your order status. How can I help?";
