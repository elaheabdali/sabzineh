import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  VerifyResult,
} from "./port";
import { PaymentConfigurationError } from "./port";

/**
 * Zarinpal implementation of PaymentPort (Week 4: real sandbox flow,
 * following the pattern proven in ela-coffee and verified live twice
 * on its production site).
 *
 * The flow is the real one — request authority → redirect to
 * StartPay → callback → server-side verify — only no real money
 * moves in sandbox. A missing merchant id throws at construction: a
 * misconfigured gateway must fail loudly, never silently take mock
 * payments.
 *
 * Amounts: the app works in Toman integers, Zarinpal in Rial —
 * amountRial = amountToman * 10.
 *
 * Host selection (same precedence as ela-coffee):
 * 1. ZARINPAL_BASE_URL, when set, wins outright (escape hatch for
 *    local stubs and tests).
 * 2. ZARINPAL_SANDBOX — "false" selects production, anything else
 *    (including unset) selects the sandbox. Sandbox-first is
 *    deliberate: a missing flag can never silently point at live
 *    payments.
 *    - sandbox:    https://sandbox.zarinpal.com (API + StartPay)
 *    - production: https://api.zarinpal.com (API),
 *                   https://www.zarinpal.com (StartPay)
 *
 * Error semantics:
 * - createPayment throws on every failure (bad code, HTTP error,
 *   non-JSON body, network error). The caller (createOrder) releases
 *   the stock reservation and surfaces the error; no order is left
 *   pointing at a phantom payment.
 * - verify throws on transport failures (HTTP error, non-JSON body,
 *   network error) so the order stays PENDING and the customer can
 *   retry — a down gateway must not cancel a possibly-paid order.
 *   It returns FAILED only when the gateway definitively answers
 *   with an error code (wrong amount, invalid/expired authority).
 * - refund always throws: Zarinpal has no refund API. Refunds are
 *   processed in the merchant panel and recorded in Sabzineh as a
 *   wallet credit (see server/orders/service.ts settleFailedPayment).
 */
const SANDBOX_HOST = "https://sandbox.zarinpal.com";
const LIVE_API_HOST = "https://api.zarinpal.com";
const LIVE_PAY_HOST = "https://www.zarinpal.com";

interface ZarinpalRequestResponse {
  data?: { code?: number; authority?: string; message?: string };
  errors?: { code?: number; message?: string };
}

interface ZarinpalVerifyResponse {
  data?: { code?: number; ref_id?: number; message?: string };
  errors?: { code?: number; message?: string };
}

/**
 * A definitive gateway error: Zarinpal answered with an error code
 * (e.g. -51 for an unpaid authority). Unlike a transport failure,
 * this means the payment will never verify — the caller may settle
 * the order as FAILED instead of leaving it PENDING.
 */
export class ZarinpalGatewayError extends Error {
  readonly code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = "ZarinpalGatewayError";
    this.code = code;
  }
}

export class ZarinpalPaymentPort implements PaymentPort {
  readonly provider = "zarinpal" as const;
  private readonly merchantId: string;
  private readonly sandbox: boolean;

  constructor() {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) {
      throw new PaymentConfigurationError(
        "ZARINPAL_MERCHANT_ID is not set. Set a sandbox merchant id or use PAYMENT_PROVIDER=mock.",
      );
    }
    this.merchantId = merchantId;
    this.sandbox = process.env.ZARINPAL_SANDBOX !== "false";
  }

  private get apiBase(): string {
    if (process.env.ZARINPAL_BASE_URL) return process.env.ZARINPAL_BASE_URL;
    return this.sandbox ? SANDBOX_HOST : LIVE_API_HOST;
  }

  private get payBase(): string {
    if (process.env.ZARINPAL_BASE_URL) return process.env.ZARINPAL_BASE_URL;
    return this.sandbox ? SANDBOX_HOST : LIVE_PAY_HOST;
  }

  /**
   * POSTs JSON and returns the parsed body.
   *
   * Throws a plain Error on network failures and non-JSON bodies
   * (transient — the caller may retry, the order stays PENDING),
   * and a ZarinpalGatewayError when the gateway answers with a
   * definitive error code (e.g. -51 unpaid authority) — that one
   * is final, not retryable.
   */
  private async postJson(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(
        `Zarinpal ${path} failed: network error (${error instanceof Error ? error.message : "unknown"})`,
      );
    }
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Zarinpal ${path} failed: non-JSON response (HTTP ${response.status})`,
      );
    }
    if (!response.ok) {
      const parsed = data as ZarinpalRequestResponse;
      const message = parsed?.errors?.message ?? parsed?.data?.message ?? `HTTP ${response.status}`;
      const code = parsed?.errors?.code;
      if (typeof code === "number") {
        throw new ZarinpalGatewayError(`Zarinpal ${path} failed: ${message}`, code);
      }
      throw new Error(`Zarinpal ${path} failed: ${message}`);
    }
    return data;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Zarinpal amounts are in Rial: 1 Toman = 10 Rial.
    const data = (await this.postJson("/pg/v4/payment/request.json", {
      merchant_id: this.merchantId,
      amount: input.amount * 10,
      description: input.description,
      callback_url: input.callbackUrl,
      // NOTE (Week 4): no metadata.order_id. Zarinpal rejects order
      // ids longer than 40 chars, and Sabzineh order ids are
      // `order-<uuid>` = 42 chars (ela-coffee sends a bare 36-char
      // uuid, which is why the same field works there). The order id
      // is already in `description` (set by the caller).
    })) as ZarinpalRequestResponse;
    const authority = data.data?.authority;
    if (data.data?.code !== 100 || !authority) {
      throw new Error(
        `Zarinpal request failed: ${data.data?.message ?? data.errors?.message ?? "unknown error"}`,
      );
    }
    return { authority, paymentUrl: this.paymentUrlFor(authority) };
  }

  paymentUrlFor(authority: string): string {
    return `${this.payBase}/pg/StartPay/${authority}`;
  }

  async verify(authority: string, amount: number): Promise<VerifyResult> {
    let data: ZarinpalVerifyResponse;
    try {
      data = (await this.postJson("/pg/v4/payment/verify.json", {
        merchant_id: this.merchantId,
        authority,
        amount: amount * 10,
      })) as ZarinpalVerifyResponse;
    } catch (error) {
      // The sandbox answers an UNPAID authority with HTTP 401 +
      // errors.code -51 ("Session is not valid...") — a definitive
      // failure, not a transport problem. Settle it FAILED so the
      // order is cancelled instead of stuck PENDING forever.
      if (error instanceof ZarinpalGatewayError) return { status: "FAILED", refId: null };
      throw error;
    }
    // 100 = verified, 101 = already verified (idempotent replay).
    if (data.data?.code === 100 || data.data?.code === 101) {
      return { status: "PAID", refId: String(data.data.ref_id) };
    }
    // A definitive gateway error (e.g. -51 amount mismatch, -53
    // invalid authority): the payment did not go through.
    return { status: "FAILED", refId: null };
  }

  async refund(_refId: string, _amount: number): Promise<{ ok: boolean }> {
    void _refId;
    void _amount;
    // Zarinpal has no direct refund API; refunds are handled via the
    // merchant panel and recorded as a wallet credit (Week 4).
    throw new Error("Zarinpal refunds are processed via the merchant panel, not the API.");
  }
}
