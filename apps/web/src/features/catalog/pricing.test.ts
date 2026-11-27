import { describe, expect, it } from "vitest";
import { calcCommission, calcDiscount, calcSubtotal, calcWalletApplied } from "./pricing";

describe("calcCommission", () => {
  it("splits gross into commission and net at the plan rate", () => {
    expect(calcCommission(1_000_000, 0.12)).toEqual({ gross: 1_000_000, commission: 120_000, net: 880_000 });
  });

  it("rounds to whole Toman", () => {
    expect(calcCommission(999, 0.1)).toEqual({ gross: 999, commission: 100, net: 899 });
  });

  it("rejects rates outside 0..1", () => {
    expect(() => calcCommission(1000, 1.5)).toThrow();
    expect(() => calcCommission(-1, 0.1)).toThrow();
  });
});

describe("calcWalletApplied", () => {
  it("caps the wallet at the payable amount", () => {
    expect(calcWalletApplied(100_000, 250_000)).toEqual({ walletApplied: 100_000, remainingPayable: 0 });
  });

  it("leaves the remainder payable when the wallet is short", () => {
    expect(calcWalletApplied(100_000, 40_000)).toEqual({ walletApplied: 40_000, remainingPayable: 60_000 });
  });

  it("treats negative inputs as zero", () => {
    expect(calcWalletApplied(-5, -10)).toEqual({ walletApplied: 0, remainingPayable: 0 });
  });
});

describe("calcDiscount", () => {
  it("applies a percent discount above the minimum", () => {
    expect(calcDiscount(500_000, { type: "PERCENT", value: 10, minAmount: 200_000 })).toBe(50_000);
  });

  it("returns zero below the minimum amount", () => {
    expect(calcDiscount(100_000, { type: "PERCENT", value: 10, minAmount: 200_000 })).toBe(0);
  });

  it("caps a fixed discount at the subtotal", () => {
    expect(calcDiscount(30_000, { type: "FIXED", value: 50_000, minAmount: 0 })).toBe(30_000);
  });
});

describe("calcSubtotal", () => {
  it("sums price × qty", () => {
    expect(
      calcSubtotal([
        { price: 90_000, qty: 2 },
        { price: 50_000, qty: 1 },
      ]),
    ).toBe(230_000);
  });
});
