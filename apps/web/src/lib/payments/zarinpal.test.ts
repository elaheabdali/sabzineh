import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPaymentPort, PaymentConfigurationError } from "./port";
import { ZarinpalPaymentPort } from "./zarinpal";

/**
 * Zarinpal port tests (Week 4). The gateway is never hit: fetch is
 * stubbed per test. Amounts are Toman in the app, Rial on the wire
 * (x10) — every assertion pins that conversion.
 */

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function htmlResponse(status = 500): Response {
  return {
    ok: false,
    status,
    text: async () => "<html><body>Server Error</body></html>",
  } as Response;
}

function stubFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  if (response instanceof Error) mock.mockRejectedValue(response);
  else mock.mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("ZarinpalPaymentPort", () => {
  beforeEach(() => {
    vi.stubEnv("ZARINPAL_MERCHANT_ID", MERCHANT_ID);
    vi.stubEnv("ZARINPAL_SANDBOX", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws at construction without a merchant id", () => {
    vi.stubEnv("ZARINPAL_MERCHANT_ID", "");
    expect(() => new ZarinpalPaymentPort()).toThrow(PaymentConfigurationError);
  });

  it("createPayment requests an authority in Rial and returns the StartPay URL", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ data: { code: 100, authority: "S000000000000000000000000000000abc123", message: "Success" } }),
    );
    const port = new ZarinpalPaymentPort();
    const result = await port.createPayment({
      orderId: "ord-1",
      amount: 180_000,
      description: "Sabzineh order ord-1",
      callbackUrl: "https://shop.example/api/payments/callback",
    });
    expect(result).toEqual({
      authority: "S000000000000000000000000000000abc123",
      paymentUrl: "https://sandbox.zarinpal.com/pg/StartPay/S000000000000000000000000000000abc123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sandbox.zarinpal.com/pg/v4/payment/request.json");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      merchant_id: MERCHANT_ID,
      amount: 1_800_000, // 180,000 Toman -> Rial
      description: "Sabzineh order ord-1",
      callback_url: "https://shop.example/api/payments/callback",
    });
    // No metadata.order_id: Zarinpal rejects order ids over 40 chars
    // and Sabzineh ids are `order-<uuid>` = 42 chars (Week 4 fix).
    expect(body).not.toHaveProperty("metadata");
  });

  it("createPayment works with a 42-char order id (regression: metadata.order_id)", async () => {
    // Sabzineh order ids are `order-<uuid>` = 42 chars. Zarinpal
    // rejects metadata.order_id longer than 40 chars, so the port
    // must not send it — otherwise every real checkout fails.
    const fetchMock = stubFetch(
      jsonResponse({ data: { code: 100, authority: "S000000000000000000000000000000abc123" } }),
    );
    const port = new ZarinpalPaymentPort();
    const orderId = `order-${"a".repeat(36)}`;
    expect(orderId).toHaveLength(42);
    const result = await port.createPayment({
      orderId,
      amount: 1000,
      description: `Sabzineh order ${orderId}`,
      callbackUrl: "https://x/cb",
    });
    expect(result.authority).toBe("S000000000000000000000000000000abc123");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("metadata");
  });

  it("createPayment throws on a gateway error code", async () => {
    stubFetch(jsonResponse({ data: { code: -9, message: "validation error" } }));
    const port = new ZarinpalPaymentPort();
    await expect(
      port.createPayment({ orderId: "ord-1", amount: 1000, description: "x", callbackUrl: "https://x/cb" }),
    ).rejects.toThrow("Zarinpal request failed: validation error");
  });

  it("createPayment throws a clear error on a non-JSON HTTP error page", async () => {
    stubFetch(htmlResponse(500));
    const port = new ZarinpalPaymentPort();
    await expect(
      port.createPayment({ orderId: "ord-1", amount: 1000, description: "x", callbackUrl: "https://x/cb" }),
    ).rejects.toThrow("non-JSON response (HTTP 500)");
  });

  it("createPayment throws on a network failure", async () => {
    stubFetch(new Error("fetch failed"));
    const port = new ZarinpalPaymentPort();
    await expect(
      port.createPayment({ orderId: "ord-1", amount: 1000, description: "x", callbackUrl: "https://x/cb" }),
    ).rejects.toThrow("network error");
  });

  it("verify returns PAID with the ref id on code 100", async () => {
    stubFetch(jsonResponse({ data: { code: 100, ref_id: 123456789, message: "Success" } }));
    const port = new ZarinpalPaymentPort();
    await expect(port.verify("S000authority", 180_000)).resolves.toEqual({
      status: "PAID",
      refId: "123456789",
    });
  });

  it("verify returns PAID on code 101 (already verified)", async () => {
    stubFetch(jsonResponse({ data: { code: 101, ref_id: 987654321, message: "Verified" } }));
    const port = new ZarinpalPaymentPort();
    await expect(port.verify("S000authority", 180_000)).resolves.toEqual({
      status: "PAID",
      refId: "987654321",
    });
  });

  it("verify returns FAILED on an amount-mismatch code", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ data: { code: -51, message: "amount mismatch" } }),
    );
    const port = new ZarinpalPaymentPort();
    await expect(port.verify("S000authority", 180_000)).resolves.toEqual({
      status: "FAILED",
      refId: null,
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as Record<
      string,
      unknown
    >;
    expect(body.amount).toBe(1_800_000); // the server-side amount, in Rial
  });

  it("verify returns FAILED on HTTP 401 with errors.code -51 (unpaid authority)", async () => {
    // The sandbox answers verify for an authority that was never
    // paid with HTTP 401 + errors.code -51 ("Session is not valid,
    // session is not active paid try."). That is a definitive
    // failure: the order must be cancelled, not left PENDING.
    stubFetch(
      jsonResponse(
        {
          data: {},
          errors: {
            message: "Session is not valid, session is not active paid try.",
            code: -51,
            validations: [],
          },
        },
        false,
        401,
      ),
    );
    const port = new ZarinpalPaymentPort();
    await expect(port.verify("S000authority", 180_000)).resolves.toEqual({
      status: "FAILED",
      refId: null,
    });
  });

  it("verify throws on a transport failure so the order stays PENDING", async () => {
    stubFetch(htmlResponse(502));
    const port = new ZarinpalPaymentPort();
    await expect(port.verify("S000authority", 180_000)).rejects.toThrow("non-JSON response (HTTP 502)");
  });

  it("paymentUrlFor uses www.zarinpal.com when sandbox is off", () => {
    vi.stubEnv("ZARINPAL_SANDBOX", "false");
    const port = new ZarinpalPaymentPort();
    expect(port.paymentUrlFor("S000authority")).toBe("https://www.zarinpal.com/pg/StartPay/S000authority");
  });

  it("ZARINPAL_BASE_URL wins over the sandbox flag", async () => {
    vi.stubEnv("ZARINPAL_BASE_URL", "https://stub.local");
    const fetchMock = stubFetch(
      jsonResponse({ data: { code: 100, authority: "S000stub", message: "Success" } }),
    );
    const port = new ZarinpalPaymentPort();
    await port.createPayment({ orderId: "ord-1", amount: 1000, description: "x", callbackUrl: "https://x/cb" });
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://stub.local/pg/v4/payment/request.json",
    );
  });

  it("refund throws: Zarinpal has no refund API", async () => {
    const port = new ZarinpalPaymentPort();
    await expect(port.refund("ref-1", 1000)).rejects.toThrow("merchant panel");
  });

  it("getPaymentPort selects zarinpal from PAYMENT_PROVIDER", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "zarinpal");
    expect(getPaymentPort().provider).toBe("zarinpal");
  });
});
