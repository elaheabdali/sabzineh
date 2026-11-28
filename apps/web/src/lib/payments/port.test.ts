import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getPaymentPort, PaymentConfigurationError } from "./port";

describe("getPaymentPort", () => {
  const original = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = original;
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the mock provider outside production", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const port = getPaymentPort();
    expect(port.provider).toBe("mock");
    const created = await port.createPayment({
      orderId: "ord-1",
      amount: 100_000,
      description: "test",
      callbackUrl: "http://localhost/callback",
    });
    // Phase 1: the authority is an unguessable random credential,
    // never derived from the (learnable) order id.
    expect(created.authority).toMatch(/^MOCK-/);
    expect(created.authority).not.toContain("ord-1");
    const verified = await port.verify(created.authority, 100_000);
    expect(verified.status).toBe("PAID");
    expect(verified.refId).toBe(`MOCK-REF-${created.authority.slice("MOCK-".length)}`);
    // Note: a forged "MOCK-<orderId>" can no longer be used against
    // a real order, because finalizePayment first looks the payment
    // up by authority — and no Payment row ever holds that value now.
  });

  it("refuses the implicit mock default in production", () => {
    delete process.env.PAYMENT_PROVIDER;
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getPaymentPort()).toThrow(PaymentConfigurationError);
    // …but an explicit mock choice is still honoured.
    process.env.PAYMENT_PROVIDER = "mock";
    expect(getPaymentPort().provider).toBe("mock");
  });

  it("fails verify for a foreign authority", async () => {
    const port = getPaymentPort();
    expect(await port.verify("SOMEONE-ELSE", 100_000)).toEqual({ status: "FAILED", refId: null });
  });

  it("rejects an unknown provider name", () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    expect(() => getPaymentPort()).toThrow(PaymentConfigurationError);
  });
});
