import { describe, it, expect } from "vitest";
import { project, type ProjectionInput } from "../projection";
import { type TransactionRule } from "../recurrence";

function makeRule(overrides: Partial<TransactionRule> & { id: string }): TransactionRule {
  return {
    isRecurring: false,
    isFinite: false,
    amount: 0,
    status: "pending",
    type: "expense",
    ...overrides,
  } as TransactionRule;
}

describe("project", () => {
  it("returns current balance unchanged when no transactions", () => {
    const input: ProjectionInput = {
      currentBalance: 1000,
      rules: [],
      referenceDate: new Date("2024-01-01"),
    };
    const result = project(input);
    expect(result.days[0].balance).toBe(1000);
    expect(result.balanceAt7).toBe(1000);
  });

  it("deducts a one-time expense on the correct day", () => {
    const rule = makeRule({
      id: "r1",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: new Date("2024-01-05"),
      amount: 200,
      type: "expense",
    });
    const result = project({
      currentBalance: 1000,
      rules: [rule],
      referenceDate: new Date("2024-01-01"),
    });

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
      specificDate: new Date("2024-01-10"),
      amount: 3000,
      type: "income",
    });
    const result = project({
      currentBalance: 500,
      rules: [rule],
      referenceDate: new Date("2024-01-01"),
    });

    const day10 = result.days.find((d) => d.date === "2024-01-10")!;
    expect(day10.balance).toBe(3500);
  });

  it("flags overdraft days correctly", () => {
    const rule = makeRule({
      id: "r3",
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: new Date("2024-01-03"),
      amount: 600,
      type: "expense",
    });
    const result = project({
      currentBalance: 400,
      rules: [rule],
      referenceDate: new Date("2024-01-01"),
    });

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
    const result = project({
      currentBalance: 1000,
      rules: [rule],
      referenceDate: new Date("2024-01-01"),
      windowDays: 40,
    });

    // Should hit on Jan 5 and Feb 5
    const jan5 = result.days.find((d) => d.date === "2024-01-05")!;
    const feb5 = result.days.find((d) => d.date === "2024-02-05")!;
    expect(jan5.balance).toBe(900);
    expect(feb5.balance).toBe(800);
  });

  it("balanceAt7/14/30 pick correct day indexes", () => {
    const result = project({
      currentBalance: 1000,
      rules: [],
      referenceDate: new Date("2024-01-01"),
    });
    expect(result.balanceAt7).toBe(result.days[7].balance);
    expect(result.balanceAt14).toBe(result.days[14].balance);
    expect(result.balanceAt30).toBe(result.days[30].balance);
  });
});
