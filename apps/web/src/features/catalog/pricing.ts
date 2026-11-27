/**
 * Pure money math — commission, wallet, discounts.
 * All amounts are integer Toman. Every function is unit-tested;
 * the same functions run server-side at order creation (Week 4).
 */

/** Vendor payout for one order item: gross, commission, net. */
export function calcCommission(gross: number, commissionRate: number): {
  gross: number;
  commission: number;
  net: number;
} {
  if (gross < 0) throw new Error("gross must be non-negative");
  if (commissionRate < 0 || commissionRate > 1) {
    throw new Error("commissionRate must be between 0 and 1");
  }
  const commission = Math.round(gross * commissionRate);
  return { gross, commission, net: gross - commission };
}

/** How much of the wallet balance applies to a payable amount. */
export function calcWalletApplied(payable: number, walletBalance: number): {
  walletApplied: number;
  remainingPayable: number;
} {
  const walletApplied = Math.max(0, Math.min(Math.max(0, payable), Math.max(0, walletBalance)));
  return { walletApplied, remainingPayable: Math.max(0, payable) - walletApplied };
}

/** Discount value for a cart subtotal. PERCENT rounds down to the Toman. */
export function calcDiscount(
  subtotal: number,
  discount: { type: "PERCENT" | "FIXED"; value: number; minAmount: number },
): number {
  if (subtotal < discount.minAmount) return 0;
  if (discount.type === "PERCENT") {
    return Math.floor((subtotal * discount.value) / 100);
  }
  return Math.min(discount.value, subtotal);
}

/** Cart subtotal from line items (price × qty). */
export function calcSubtotal(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
