/**
 * PaymentPort — the only payment boundary in the app.
 * Business code never imports a gateway directly; it calls
 * `getPaymentPort()`, which selects the implementation from
 * PAYMENT_PROVIDER ("mock" default, "zarinpal" sandbox).
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
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

export function getPaymentPort(): PaymentPort {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  if (provider === "zarinpal") return new ZarinpalPaymentPort();
  if (provider !== "mock") {
    throw new PaymentConfigurationError(`Unknown PAYMENT_PROVIDER: ${provider}`);
  }
  return new MockPaymentPort();
}
