import { describe, it, expect } from "vitest";
import { computeRedline, type RedlineInput } from "../redline";
import { project } from "../projection";

function makeProjection(balance: number) {
  return project({ currentBalance: balance, rules: [], referenceDate: new Date("2024-01-01") });
}

describe("computeRedline", () => {
  it("returns null redlineDate when avg spend is 0", () => {
    const result = computeRedline({
      projection: makeProjection(1000),
      recentTransactions: [],
      referenceDate: new Date("2024-01-01"),
    });
    expect(result.redlineDate).toBeNull();
    expect(result.daysUntilRedline).toBeNull();
  });

  it("computes correct average daily spend", () => {
    const ref = new Date("2024-01-15");
    const transactions = [
      { date: new Date("2024-01-08"), amount: 280, type: "expense" },
    ];
    const result = computeRedline({
      projection: makeProjection(1000),
      recentTransactions: transactions,
      lookbackDays: 14,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(20); // 280 / 14
  });

  it("predicts redline date at correct day", () => {
    // Balance $100, spending $20/day → hits 0 on day 5
    const ref = new Date("2024-01-01");
    const transactions = [
      { date: new Date("2023-12-25"), amount: 140, type: "expense" }, // 7 days at $20/day within 14-day lookback
    ];
    const result = computeRedline({
      projection: makeProjection(100),
      recentTransactions: transactions,
      lookbackDays: 7,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(20);
    expect(result.daysUntilRedline).toBe(6); // day 0=$100, day 5=$0, day 6=-$20
    expect(result.redlineDate).toBe("2024-01-07");
  });

  it("ignores income transactions in spend calculation", () => {
    const ref = new Date("2024-01-15");
    const transactions = [
      { date: new Date("2024-01-10"), amount: 1000, type: "income" },
    ];
    const result = computeRedline({
      projection: makeProjection(500),
      recentTransactions: transactions,
      lookbackDays: 14,
      referenceDate: ref,
    });
    expect(result.averageDailySpend).toBe(0);
    expect(result.redlineDate).toBeNull();
  });
});
