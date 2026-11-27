import { calcCommission } from "@/features/catalog/pricing";

/**
 * Billing: commission + payout aggregation.
 * Rates come from the vendor's plan at order time and are snapshotted
 * on OrderItem; this module only does the math, never reads a plan.
 */
export { calcCommission };

export interface PayoutLine {
  gross: number;
  commissionRate: number;
}

/** Sums a vendor's order items into one payout period. */
export function calcPayout(lines: PayoutLine[]): { gross: number; commission: number; net: number } {
  let gross = 0;
  let commission = 0;
  for (const line of lines) {
    const result = calcCommission(line.gross, line.commissionRate);
    gross += result.gross;
    commission += result.commission;
  }
  return { gross, commission, net: gross - commission };
}
