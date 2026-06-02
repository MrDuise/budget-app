import { addDays, format, startOfDay } from "date-fns";
import { type ProjectionResult } from "./projection";

export interface RedlineInput {
  projection: ProjectionResult;
  recentTransactions: Array<{ date: Date; amount: number; type: string }>;
  lookbackDays?: number;
  referenceDate?: Date;
}

export interface RedlineResult {
  averageDailySpend: number;
  redlineDate: string | null;
  daysUntilRedline: number | null;
  trajectoryBalances: Array<{ date: string; balance: number }>;
}

export function computeRedline(input: RedlineInput): RedlineResult {
  const { projection, recentTransactions, lookbackDays = 14, referenceDate = new Date() } = input;

  const today = startOfDay(referenceDate);
  const cutoff = addDays(today, -lookbackDays);

  const expensesInWindow = recentTransactions.filter(
    (t) => t.type === "expense" && startOfDay(t.date) >= cutoff && startOfDay(t.date) < today
  );

  const totalSpent = expensesInWindow.reduce((sum, t) => sum + t.amount, 0);
  const averageDailySpend = lookbackDays > 0 ? totalSpent / lookbackDays : 0;

  if (averageDailySpend <= 0 || projection.days.length === 0) {
    return { averageDailySpend: 0, redlineDate: null, daysUntilRedline: null, trajectoryBalances: [] };
  }

  // Build trajectory: start from today's projected balance and subtract avg daily spend
  const todayBalance = projection.days[0]?.balance ?? 0;
  const trajectoryBalances: Array<{ date: string; balance: number }> = [];
  let redlineDate: string | null = null;
  let daysUntilRedline: number | null = null;

  for (let i = 0; i < projection.days.length; i++) {
    const d = addDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const balance = Math.round((todayBalance - averageDailySpend * i) * 100) / 100;

    trajectoryBalances.push({ date: key, balance });

    if (balance < 0 && redlineDate === null) {
      redlineDate = key;
      daysUntilRedline = i;
    }
  }

  return { averageDailySpend: Math.round(averageDailySpend * 100) / 100, redlineDate, daysUntilRedline, trajectoryBalances };
}
