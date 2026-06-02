import { describe, it, expect } from "vitest";
import { generateReport, type ReportTransaction, type BudgetLimit } from "../reports";

const tx = (
  id: string,
  amount: number,
  type: string,
  categoryId: string,
  date: string
): ReportTransaction => ({
  id,
  amount,
  type,
  categoryId,
  categoryName: `Cat ${categoryId}`,
  categoryType: "VARIABLE_REGULAR",
  date: new Date(date),
  name: `Tx ${id}`,
});

describe("generateReport", () => {
  it("totals income and expenses correctly", () => {
    const transactions = [
      tx("1", 3000, "income", "salary", "2024-01-15"),
      tx("2", 500, "expense", "groceries", "2024-01-10"),
      tx("3", 200, "expense", "dining", "2024-01-12"),
    ];
    const result = generateReport(transactions, [], new Date("2024-01-01"), new Date("2024-01-31"));
    expect(result.totalIncome).toBe(3000);
    expect(result.totalExpenses).toBe(700);
    expect(result.netIncome).toBe(2300);
  });

  it("excludes transactions outside date range", () => {
    const transactions = [
      tx("1", 100, "expense", "groceries", "2023-12-31"),
      tx("2", 200, "expense", "groceries", "2024-01-15"),
      tx("3", 300, "expense", "groceries", "2024-02-01"),
    ];
    const result = generateReport(transactions, [], new Date("2024-01-01"), new Date("2024-01-31"));
    expect(result.totalExpenses).toBe(200);
  });

  it("includes transactions on boundary dates", () => {
    const transactions = [
      tx("1", 100, "expense", "groceries", "2024-01-01"),
      tx("2", 100, "expense", "groceries", "2024-01-31"),
    ];
    const result = generateReport(transactions, [], new Date("2024-01-01"), new Date("2024-01-31"));
    expect(result.totalExpenses).toBe(200);
  });

  it("computes over/under budget per category", () => {
    const transactions = [tx("1", 150, "expense", "groceries", "2024-01-10")];
    const budgets: BudgetLimit[] = [{ categoryId: "groceries", amount: 120 }];
    const result = generateReport(transactions, budgets, new Date("2024-01-01"), new Date("2024-01-31"));
    const cat = result.byCategory.find((c) => c.categoryId === "groceries")!;
    expect(cat.spent).toBe(150);
    expect(cat.budgeted).toBe(120);
    expect(cat.overUnder).toBe(-30); // over by 30
  });

  it("computes backOnTrackAmount from over-budget categories", () => {
    const transactions = [
      tx("1", 200, "expense", "groceries", "2024-01-10"),
      tx("2", 80, "expense", "dining", "2024-01-12"),
    ];
    const budgets: BudgetLimit[] = [
      { categoryId: "groceries", amount: 150 }, // over by 50
      { categoryId: "dining", amount: 100 },    // under by 20
    ];
    const result = generateReport(transactions, budgets, new Date("2024-01-01"), new Date("2024-01-31"));
    expect(result.backOnTrackAmount).toBe(50);
  });

  it("returns on-track description when within all budgets", () => {
    const transactions = [tx("1", 80, "expense", "groceries", "2024-01-10")];
    const budgets: BudgetLimit[] = [{ categoryId: "groceries", amount: 100 }];
    const result = generateReport(transactions, budgets, new Date("2024-01-01"), new Date("2024-01-31"));
    expect(result.backOnTrackAmount).toBe(0);
    expect(result.backOnTrackDescription).toContain("On track");
  });
});
