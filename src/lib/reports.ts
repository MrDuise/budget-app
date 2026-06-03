import { startOfDay, isAfter, isBefore, isEqual } from "date-fns";

export interface ReportTransaction {
  id: string;
  amount: number;
  type: string;
  categoryId: string;
  categoryName: string;
  categoryType: string;
  date: Date;
  name: string;
}

export interface BudgetLimit {
  categoryId: string;
  amount: number;
}

export interface CategoryReport {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  spent: number;
  budgeted: number;
  overUnder: number;
}

export interface ReportResult {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  byCategory: CategoryReport[];
  backOnTrackAmount: number;
  backOnTrackDescription: string;
}

export function generateReport(
  transactions: ReportTransaction[],
  budgets: BudgetLimit[],
  from: Date,
  to: Date
): ReportResult {
  const start = startOfDay(from);
  const end = startOfDay(to);

  const inRange = transactions.filter((t) => {
    const d = startOfDay(t.date);
    return (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
  });

  let totalIncome = 0;
  let totalExpenses = 0;

  const categoryMap = new Map<string, CategoryReport>();

  for (const t of inRange) {
    if (t.type === "income") {
      totalIncome += t.amount;
      continue;
    }

    if (t.type !== "expense") continue; // transfers excluded from totals

    totalExpenses += t.amount;

    const existing = categoryMap.get(t.categoryId) ?? {
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      categoryType: t.categoryType,
      spent: 0,
      budgeted: 0,
      overUnder: 0,
    };
    existing.spent += t.amount;
    categoryMap.set(t.categoryId, existing);
  }

  for (const budget of budgets) {
    const cat = categoryMap.get(budget.categoryId);
    if (cat) {
      cat.budgeted = budget.amount;
    } else {
      categoryMap.set(budget.categoryId, {
        categoryId: budget.categoryId,
        categoryName: "",
        categoryType: "",
        spent: 0,
        budgeted: budget.amount,
        overUnder: 0,
      });
    }
  }

  const byCategory: CategoryReport[] = Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    overUnder: cat.budgeted - cat.spent, // positive = under budget
  }));

  byCategory.sort((a, b) => a.overUnder - b.overUnder); // worst first

  const totalOverBudget = byCategory.reduce(
    (sum, c) => sum + (c.overUnder < 0 ? Math.abs(c.overUnder) : 0),
    0
  );

  const backOnTrackAmount = Math.max(0, totalOverBudget);
  const backOnTrackDescription =
    backOnTrackAmount > 0
      ? `Reduce spending by $${backOnTrackAmount.toFixed(2)} to get back on budget`
      : "On track — within budget across all categories";

  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    byCategory,
    backOnTrackAmount,
    backOnTrackDescription,
  };
}
