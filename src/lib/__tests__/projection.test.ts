import { describe, it, expect } from "vitest";
import { project, type ProjectionInput } from "../projection";
import { type TransactionRule } from "../recurrence";

// Local midnight dates to avoid UTC offset issues
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

describe("project", () => {
  it("returns current balance unchanged when no transactions", () => {
    const result = project({ currentBalance: 1000, rules: [], referenceDate: d(2024, 1, 1) });
    expect(result.days[0].balance).toBe(1000);
    expect(result.balanceAt7).toBe(1000);
  });

  it("deducts a one-time expense on the correct day", () => {
    const rule = makeRule({
      id: "r1",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 1, 5),
      amount: 200,
      type: "expense",
    });
    const result = project({ currentBalance: 1000, rules: [rule], referenceDate: d(2024, 1, 1) });

    const day4 = result.days.find((d) => d.date === "2024-01-04")!;
    const day5 = result.days.find((d) => d.date === "2024-01-05")!;
    expect(day4.balance).toBe(1000);
    expect(day5.balance).toBe(800);
  });

  it("adds income on the correct day", () => {
    const rule = makeRule({
      id: "r2",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 1, 10),
      amount: 3000,
      type: "income",
    });
    const result = project({ currentBalance: 500, rules: [rule], referenceDate: d(2024, 1, 1) });
    const day10 = result.days.find((d) => d.date === "2024-01-10")!;
    expect(day10.balance).toBe(3500);
  });

  it("flags overdraft days correctly", () => {
    const rule = makeRule({
      id: "r3",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 1, 3),
      amount: 600,
      type: "expense",
    });
    const result = project({ currentBalance: 400, rules: [rule], referenceDate: d(2024, 1, 1) });
    expect(result.overdraftDays).toContain("2024-01-03");
    expect(result.balanceAt7).toBe(-200);
  });

  it("monthly recurring expense compounds correctly", () => {
    const rule = makeRule({
      id: "r4",
      isRecurring: true,
      recurrencePattern: "monthly",
      dueDay: 5,
      amount: 100,
      type: "expense",
    });
    const result = project({ currentBalance: 1000, rules: [rule], referenceDate: d(2024, 1, 1), windowDays: 40 });
    const jan5 = result.days.find((d) => d.date === "2024-01-05")!;
    const feb5 = result.days.find((d) => d.date === "2024-02-05")!;
    expect(jan5.balance).toBe(900);
    expect(feb5.balance).toBe(800);
  });

  it("balanceAt7/14/30 pick correct day indexes", () => {
    const result = project({ currentBalance: 1000, rules: [], referenceDate: d(2024, 1, 1) });
    expect(result.balanceAt7).toBe(result.days[7].balance);
    expect(result.balanceAt14).toBe(result.days[14].balance);
    expect(result.balanceAt30).toBe(result.days[30].balance);
  });

  it("income and expense on the same day net correctly", () => {
    const income = makeRule({
      id: "inc",
      recurrencePattern: "once",
      specificDate: d(2024, 1, 5),
      amount: 3000,
      type: "income",
    });
    const expense = makeRule({
      id: "exp",
      recurrencePattern: "once",
      specificDate: d(2024, 1, 5),
      amount: 500,
      type: "expense",
    });
    const result = project({ currentBalance: 100, rules: [income, expense], referenceDate: d(2024, 1, 1) });
    const day5 = result.days.find((d) => d.date === "2024-01-05")!;
    expect(day5.income).toBe(3000);
    expect(day5.expenses).toBe(500);
    expect(day5.balance).toBe(2600); // 100 + 3000 - 500
  });

  it("transfer type does not affect running balance", () => {
    const transfer = makeRule({
      id: "tr",
      recurrencePattern: "once",
      specificDate: d(2024, 1, 5),
      amount: 500,
      type: "transfer",
    });
    const result = project({ currentBalance: 1000, rules: [transfer], referenceDate: d(2024, 1, 1) });
    const day5 = result.days.find((d) => d.date === "2024-01-05")!;
    expect(day5.balance).toBe(1000); // unchanged — transfers don't affect total balance
  });

  it("multiple expenses compound day by day", () => {
    const rules = [
      makeRule({ id: "e1", recurrencePattern: "once", specificDate: d(2024, 1, 2), amount: 100, type: "expense" }),
      makeRule({ id: "e2", recurrencePattern: "once", specificDate: d(2024, 1, 4), amount: 200, type: "expense" }),
      makeRule({ id: "e3", recurrencePattern: "once", specificDate: d(2024, 1, 6), amount: 50, type: "expense" }),
    ];
    const result = project({ currentBalance: 1000, rules, referenceDate: d(2024, 1, 1) });
    expect(result.days.find((d) => d.date === "2024-01-02")!.balance).toBe(900);
    expect(result.days.find((d) => d.date === "2024-01-04")!.balance).toBe(700);
    expect(result.days.find((d) => d.date === "2024-01-06")!.balance).toBe(650);
  });
});
