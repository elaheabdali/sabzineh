/**
 * PaymentPort — the only payment boundary in the app.
 * Business code never imports a gateway directly; it calls
 * `getPaymentPort()`, which selects the implementation from
 * PAYMENT_PROVIDER ("mock" for local dev/tests, "zarinpal" sandbox).
 *
 * Phase 1 (security): mock is a dev-only default. In production an
 * unset PAYMENT_PROVIDER is a configuration error, not a silent
 * fall-back to a fake gateway whose payments anyone could forge.
 * A production demo that deliberately wants the mock must say so
 * explicitly with PAYMENT_PROVIDER=mock.
 */
import { MockPaymentPort } from "./mock";
import { ZarinpalPaymentPort } from "./zarinpal";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface CreatePaymentInput {
  orderId: string;
  /** Integer Toman. */
  amount: number;
  description: string;
  callbackUrl: string;
  /** Locale for locale-prefixed payment pages (mock gateway). */
  locale?: string;
}

export interface CreatePaymentResult {
  authority: string;
  /** URL the customer is redirected to in order to pay. */
  paymentUrl: string;
}

export interface VerifyResult {
  status: PaymentStatus;
  /** Gateway reference id (empty unless PAID). */
  refId: string | null;
}

export interface PaymentPort {
  readonly provider: "mock" | "zarinpal";
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verify(authority: string, amount: number): Promise<VerifyResult>;
  refund(refId: string, amount: number): Promise<{ ok: boolean }>;
  /**
   * Rebuilds the customer-facing payment URL for an existing
   * authority (resume an interrupted checkout). No gateway call.
   */
  paymentUrlFor(authority: string, locale?: string): string;
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

export function getPaymentPort(): PaymentPort {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider === "zarinpal") return new ZarinpalPaymentPort();
  if (provider === "mock") return new MockPaymentPort();
  if (provider !== undefined) {
    throw new PaymentConfigurationError(`Unknown PAYMENT_PROVIDER: ${provider}`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new PaymentConfigurationError(
      "PAYMENT_PROVIDER is not set. Refusing to default to the mock gateway in production; set PAYMENT_PROVIDER=zarinpal (or =mock only for a deliberate demo).",
    );
  }
  return new MockPaymentPort();
}
