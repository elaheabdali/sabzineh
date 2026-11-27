import { describe, expect, it } from "vitest";
import {
  ASSISTANT_HANDOFF_FA,
  FAQ_FA,
  routeAssistantMessage,
} from "./assistant";
import { generateProductDraft } from "./description";

describe("routeAssistantMessage", () => {
  it("routes an order-status question to order-status", () => {
    expect(routeAssistantMessage("وضعیت سفارشم چیه؟").intent).toBe("order-status");
    expect(routeAssistantMessage("سفارشم کجاست؟").intent).toBe("order-status");
  });

  it("routes a product question to product-search", () => {
    expect(routeAssistantMessage("عسل ارگانیک چی داری؟").intent).toBe("product-search");
    expect(routeAssistantMessage("برای صبحانه چی پیشنهاد می‌کنی؟").intent).toBe("product-search");
    expect(routeAssistantMessage("عسل").intent).toBe("product-search");
  });

  it("routes subscription questions", () => {
    expect(routeAssistantMessage("اشتراک باکس چطور کار می‌کند؟").intent).toBe("subscription");
    expect(routeAssistantMessage("پلن فروشنده چیه؟").intent).toBe("subscription");
  });

  it("routes payment / shipping / discount FAQs", () => {
    expect(routeAssistantMessage("چطور پرداخت کنم؟").intent).toBe("faq-payment");
    expect(routeAssistantMessage("ارسال چقدر طول می‌کشد؟").intent).toBe("faq-shipping");
    expect(routeAssistantMessage("کد تخفیف دارید؟").intent).toBe("faq-discount");
  });

  it("routes greetings", () => {
    expect(routeAssistantMessage("سلام").intent).toBe("greeting");
  });

  it("routes an unanswerable question to unknown", () => {
    expect(routeAssistantMessage("؟").intent).toBe("unknown");
    expect(routeAssistantMessage("").intent).toBe("unknown");
  });

  it("keeps the FAQ answers honest and sourced", () => {
    expect(FAQ_FA["faq-payment"]).toContain("زرین‌پال");
    expect(FAQ_FA["faq-discount"]).toContain("سرور");
    expect(ASSISTANT_HANDOFF_FA).toContain("پشتیبانی");
  });
});

describe("generateProductDraft", () => {
  it("builds a Persian draft from title, category and attributes", () => {
    const draft = generateProductDraft({
      title: "عسل کوهی",
      categoryName: "عسل و مربا",
      vendorName: "باغ سبز کرج",
      organic: true,
      local: true,
      price: 450000,
    });
    expect(draft.description).toContain("عسل کوهی");
    expect(draft.description).toContain("عسل و مربا");
    expect(draft.description).toContain("ارگانیک");
    expect(draft.description).toContain("محلی");
    expect(draft.description).toContain("باغ سبز کرج");
    expect(draft.description).toContain("۴۵۰٬۰۰۰ تومان");
    expect(draft.tags).toContain("عسل");
    expect(draft.tags).toContain("ارگانیک");
    expect(draft.tags).toContain("محلی");
  });

  it("works without optional fields and caps tags at 8", () => {
    const draft = generateProductDraft({ title: "برنج طارم اعلا ممتاز شمال", categoryName: "برنج" });
    expect(draft.description).toContain("برنج طارم اعلا ممتاز شمال");
    expect(draft.tags.length).toBeLessThanOrEqual(8);
    expect(draft.tags).toContain("برنج");
  });

  it("builds an English draft when asked", () => {
    const draft = generateProductDraft({
      title: "Mountain honey",
      categoryName: "Honey",
      organic: true,
      locale: "en",
    });
    expect(draft.description).toContain("Mountain honey");
    expect(draft.description).toContain("organic");
  });
});
