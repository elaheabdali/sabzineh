import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  VerifyResult,
} from "./port";

/**
 * Mock gateway: no network, deterministic. Used for local development
 * and tests. The authority is stable per order so a double-submit
 * replays the same payment instead of charging twice.
 */
export class MockPaymentPort implements PaymentPort {
  readonly provider = "mock" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const authority = `MOCK-${input.orderId}`;
    return {
      authority,
      paymentUrl: `/payment/mock?authority=${encodeURIComponent(authority)}&amount=${input.amount}`,
    };
  }

  async verify(authority: string, _amount: number): Promise<VerifyResult> {
    void _amount;
    if (!authority.startsWith("MOCK-")) {
      return { status: "FAILED", refId: null };
    }
    return { status: "PAID", refId: `MOCK-REF-${authority.slice("MOCK-".length)}` };
  }

  async refund(_refId: string, _amount: number): Promise<{ ok: boolean }> {
    void _refId;
    void _amount;
    return { ok: true };
  }
}
