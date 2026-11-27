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

  it("defaults to the mock provider", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const port = getPaymentPort();
    expect(port.provider).toBe("mock");
    const created = await port.createPayment({
      orderId: "ord-1",
      amount: 100_000,
      description: "test",
      callbackUrl: "http://localhost/callback",
    });
    expect(created.authority).toBe("MOCK-ord-1");
    const verified = await port.verify(created.authority, 100_000);
    expect(verified).toEqual({ status: "PAID", refId: "MOCK-REF-ord-1" });
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
