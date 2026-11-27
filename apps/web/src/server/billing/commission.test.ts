import { describe, expect, it } from "vitest";
import { calcPayout } from "./commission";

describe("calcPayout", () => {
  it("sums gross and commission across mixed-rate lines", () => {
    expect(
      calcPayout([
        { gross: 1_000_000, commissionRate: 0.12 },
        { gross: 500_000, commissionRate: 0.08 },
      ]),
    ).toEqual({ gross: 1_500_000, commission: 160_000, net: 1_340_000 });
  });
});
