import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  VerifyResult,
} from "./port";
import { PaymentConfigurationError } from "./port";

const SANDBOX_API = "https://sandbox.zarinpal.com/pg/v4/payment";
const LIVE_API = "https://api.zarinpal.com/pg/v4/payment";

/**
 * Zarinpal sandbox implementation (Week 4 wires the callback route).
 * The flow is the real one — request authority → redirect to
 * StartPay → callback → verify — only no real money moves in sandbox.
 * A missing merchant id throws at construction: a misconfigured
 * gateway must fail loudly, never silently take mock payments.
 */
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
    return this.sandbox ? SANDBOX_API : LIVE_API;
  }

  private get payBase(): string {
    return this.sandbox
      ? "https://sandbox.zarinpal.com/pg/StartPay"
      : "https://www.zarinpal.com/pg/StartPay";
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Zarinpal amounts are in Rial: 1 Toman = 10 Rial.
    const response = await fetch(`${this.apiBase}/request.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amount * 10,
        description: input.description,
        callback_url: input.callbackUrl,
      }),
    });
    const data = (await response.json()) as {
      data?: { code?: number; authority?: string; message?: string };
      errors?: { message?: string };
    };
    const authority = data.data?.authority;
    if (data.data?.code !== 100 || !authority) {
      throw new Error(
        `Zarinpal request failed: ${data.data?.message ?? data.errors?.message ?? "unknown error"}`,
      );
    }
    return { authority, paymentUrl: `${this.payBase}/${authority}` };
  }

  async verify(authority: string, amount: number): Promise<VerifyResult> {
    const response = await fetch(`${this.apiBase}/verify.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        authority,
        amount: amount * 10,
      }),
    });
    const data = (await response.json()) as {
      data?: { code?: number; ref_id?: number; message?: string };
      errors?: { message?: string };
    };
    if (data.data?.code === 100 || data.data?.code === 101) {
      return { status: "PAID", refId: String(data.data.ref_id) };
    }
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
