import { describe, it, expect } from "vitest";
import { computeRedline } from "../redline";
import { project } from "../projection";

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

function makeProjection(balance: number, ref = d(2024, 1, 1)) {
  return project({ currentBalance: balance, rules: [], referenceDate: ref });
}

describe("computeRedline", () => {
  it("returns null redlineDate when avg spend is 0", () => {
    const result = computeRedline({
      projection: makeProjection(1000),
      recentTransactions: [],
      referenceDate: d(2024, 1, 1),
    });
    expect(result.redlineDate).toBeNull();
    expect(result.daysUntilRedline).toBeNull();
  });

  it("computes correct average daily spend", () => {
    const ref = d(2024, 1, 15);
    const result = computeRedline({
      projection: makeProjection(1000, ref),
      recentTransactions: [
        { date: d(2024, 1, 8), amount: 280, type: "expense" },
      ],
      lookbackDays: 14,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(20); // 280 / 14
  });

  it("predicts redline date at correct day", () => {
    // Balance $100, $20/day → 0 at day 5, goes negative at day 6
    const ref = d(2024, 1, 1);
    const result = computeRedline({
      projection: makeProjection(100, ref),
      recentTransactions: [
        { date: d(2023, 12, 25), amount: 140, type: "expense" }, // 7 days × $20
      ],
      lookbackDays: 7,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(20);
    expect(result.daysUntilRedline).toBe(6); // balance < 0 first at i=6
    expect(result.redlineDate).toBe("2024-01-07");
  });

  it("ignores income transactions in spend calculation", () => {
    const ref = d(2024, 1, 15);
    const result = computeRedline({
      projection: makeProjection(500, ref),
      recentTransactions: [
        { date: d(2024, 1, 10), amount: 1000, type: "income" },
      ],
      lookbackDays: 14,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(0);
    expect(result.redlineDate).toBeNull();
  });
});
