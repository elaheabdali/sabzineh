import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  VerifyResult,
} from "./port";

/**
 * Mock gateway: no network. Used for local development and tests.
 *
 * Phase 1 (security): the authority is a random UUID, NOT derived
 * from the order id. It used to be `MOCK-<orderId>` — guessable by
 * anyone who learned an order id, and verify() accepted any such
 * authority, so a stranger could mark someone else's order PAID (or
 * cancel it) for free. The authority is now an unguessable bearer
 * credential, stored on the Payment row; idempotent replays read it
 * back from there instead of recomputing it.
 */
export class MockPaymentPort implements PaymentPort {
  readonly provider = "mock" as const;

  paymentUrlFor(authority: string, locale = "fa"): string {
    return `/${locale}/payment/mock?authority=${encodeURIComponent(authority)}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const authority = `MOCK-${crypto.randomUUID()}`;
    return {
      authority,
      paymentUrl: this.paymentUrlFor(authority, input.locale ?? "fa"),
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
