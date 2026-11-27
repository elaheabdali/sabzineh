import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getCatalogRepository } from "@/features/catalog/repository";
import { parseSmartQuery } from "@/features/catalog/smart-search";
import {
  ASSISTANT_GREETING_EN,
  ASSISTANT_GREETING_FA,
  ASSISTANT_HANDOFF_EN,
  ASSISTANT_HANDOFF_FA,
  FAQ_EN,
  FAQ_FA,
  routeAssistantMessage,
} from "@/features/ai/assistant";
import { listPlans } from "@/server/billing/plans";
import { getDataStore } from "@/server/store";
import { formatPrice } from "@/lib/format";

const ORDER_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  PREPARING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  REFUNDED: "بازگشت وجه",
};

const ORDER_STATUS_EN: Record<string, string> = {
  PENDING: "awaiting payment",
  PAID: "paid",
  PREPARING: "being prepared",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

/**
 * POST /api/assistant — rule-based shopping assistant (Week 7).
 *
 * Body: { message: string, locale?: "fa" | "en" }. The message is
 * routed by fixed keyword rules (see features/ai/assistant.ts) and the
 * answer is assembled from REAL data — catalog, the caller's own
 * orders (server-side session scoping, never another user's), plans,
 * or the FAQ table. No AI API is called; an unanswerable question gets
 * an honest handoff to human support.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    locale?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > 500) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }
  const locale = body?.locale === "en" ? "en" : "fa";
  const fa = locale === "fa";
  const session = await getSession();
  const { intent } = routeAssistantMessage(message);

  if (intent === "greeting") {
    return NextResponse.json({
      intent,
      reply: fa ? ASSISTANT_GREETING_FA : ASSISTANT_GREETING_EN,
    });
  }

  if (intent === "faq-payment" || intent === "faq-shipping" || intent === "faq-discount") {
    return NextResponse.json({
      intent,
      reply: fa ? FAQ_FA[intent] : FAQ_EN[intent],
    });
  }

  if (intent === "subscription") {
    const plans = listPlans("BOX");
    const lines = plans.map(
      (p) => `• ${p.title} — ${formatPrice(p.price, locale)} / ${p.periodDays} ${fa ? "روز" : "days"}`,
    );
    return NextResponse.json({
      intent,
      reply: fa
        ? `باکس هفتگی سبزینه این‌هاست:\n${lines.join("\n")}\nمی‌توانید از صفحه اشتراک، پلن و روز تحویل را انتخاب کنید.`
        : `The Sabzineh weekly box plans are:\n${lines.join("\n")}\nYou can pick a plan and delivery day on the subscription page.`,
      plans: plans.map((p) => ({ id: p.id, title: p.title, price: p.price })),
    });
  }

  if (intent === "order-status") {
    if (!session) {
      return NextResponse.json({
        intent,
        reply: fa
          ? "برای پیگیری سفارش باید وارد حساب‌تان شوید."
          : "Please sign in to track your order.",
        needsLogin: true,
      });
    }
    const orders = await getDataStore().listOrdersByUser(session.id);
    if (orders.length === 0) {
      return NextResponse.json({
        intent,
        reply: fa ? "هنوز سفارشی ثبت نکرده‌اید." : "You have no orders yet.",
      });
    }
    const latest = orders[0];
    const status = fa
      ? (ORDER_STATUS_FA[latest.status] ?? latest.status)
      : (ORDER_STATUS_EN[latest.status] ?? latest.status);
    return NextResponse.json({
      intent,
      reply: fa
        ? `آخرین سفارش شما (${latest.id.slice(0, 8)}…) وضعیت «${status}» دارد و مبلغ آن ${formatPrice(latest.total, "fa")} است.`
        : `Your latest order (${latest.id.slice(0, 8)}…) is ${status} and totals ${formatPrice(latest.total, "en")}.`,
      orderId: latest.id,
      status: latest.status,
    });
  }

  if (intent === "product-search") {
    const parsed = parseSmartQuery(message);
    const repo = getCatalogRepository();
    const result = await repo.listProducts(parsed.params);
    const top = result.items.slice(0, 3);
    if (top.length === 0) {
      return NextResponse.json({
        intent,
        reply: fa
          ? `برای «${parsed.params.q ?? message}» چیزی پیدا نکردم. عبارت دیگری را امتحان کنید یا از صفحه جستجو فیلترها را تغییر بدهید.`
          : `I could not find anything for “${parsed.params.q ?? message}”. Try another phrase or change the filters on the search page.`,
        understood: parsed.understood,
        products: [],
      });
    }
    const lines = top.map(
      (p) => `• ${p.title} — ${formatPrice(p.price, locale)}`,
    );
    return NextResponse.json({
      intent,
      reply: fa
        ? `${parsed.understood}:\n${lines.join("\n")}`
        : `${parsed.understood}:\n${lines.join("\n")}`,
      understood: parsed.understood,
      products: top.map((p) => ({ id: p.id, title: p.title, slug: p.slug, price: p.price })),
    });
  }

  return NextResponse.json({
    intent: "unknown",
    reply: fa ? ASSISTANT_HANDOFF_FA : ASSISTANT_HANDOFF_EN,
  });
}
