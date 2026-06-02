import { describe, it, expect } from "vitest";
import { computeAllowance } from "../allowance";
import { type TransactionRule } from "../recurrence";

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

function makeRule(overrides: Partial<TransactionRule> & { id: string }): TransactionRule {
  return {
    type: "expense",
    isRecurring: false,
    isFinite: false,
    amount: 0,
    status: "pending",
    ...overrides,
  } as TransactionRule;
}

describe("computeAllowance", () => {
  it("returns balance / days remaining when no transactions", () => {
    const result = computeAllowance({
      currentBalance: 300,
      rules: [],
      alreadySpentThisMonth: 0,
      referenceDate: d(2024, 1, 15),
    });
    // Jan has 31 days; from Jan 15 inclusive = 17 days remaining
    expect(result.daysRemaining).toBe(17);
    expect(result.dailyAllowance).toBeCloseTo(300 / 17, 1);
  });

  it("subtracts fixed obligations from spendable", () => {
    const rent = makeRule({
      id: "rent",
      isRecurring: true,
      recurrencePattern: "monthly",
      dueDay: 28,
      amount: 1000,
      type: "expense",
      categoryType: "FIXED_BILL",
    });

    const result = computeAllowance({
      currentBalance: 2000,
      rules: [rent],
      alreadySpentThisMonth: 0,
      referenceDate: d(2024, 1, 15),
    });

    expect(result.fixedObligations).toBe(1000);
    expect(result.spendableRemaining).toBe(1000);
  });

  it("subtracts alreadySpent from spendable", () => {
    const result = computeAllowance({
      currentBalance: 1000,
      rules: [],
      alreadySpentThisMonth: 400,
      referenceDate: d(2024, 1, 15),
    });
    expect(result.alreadySpent).toBe(400);
    expect(result.spendableRemaining).toBe(600);
  });

  it("adds projected income", () => {
    const paycheck = makeRule({
      id: "paycheck",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 1, 20),
      amount: 3000,
      type: "income",
    });

    const result = computeAllowance({
      currentBalance: 100,
      rules: [paycheck],
      alreadySpentThisMonth: 0,
      referenceDate: d(2024, 1, 15),
    });

    expect(result.projectedIncome).toBe(3000);
    expect(result.spendableRemaining).toBe(3100);
  });

  it("never returns negative daily allowance", () => {
    const result = computeAllowance({
      currentBalance: 50,
      rules: [],
      alreadySpentThisMonth: 500,
      referenceDate: d(2024, 1, 15),
    });
    expect(result.dailyAllowance).toBeGreaterThanOrEqual(0);
    expect(result.spendableRemaining).toBe(0);
  });
});
