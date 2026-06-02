import { addDays, startOfDay, format } from "date-fns";
import { expandOccurrences, type TransactionRule } from "./recurrence";

export interface DayProjection {
  date: string; // ISO date string yyyy-MM-dd
  balance: number;
  income: number;
  expenses: number;
}

export interface ProjectionResult {
  days: DayProjection[];
  balanceAt7: number;
  balanceAt14: number;
  balanceAt30: number;
  overdraftDays: string[];
}

export interface ProjectionInput {
  currentBalance: number;
  rules: TransactionRule[];
  overrides?: Map<string, Map<string, { status: string; newDate?: Date | null; actualAmount?: number | null }>>;
  windowDays?: number;
  referenceDate?: Date;
}

export function project(input: ProjectionInput): ProjectionResult {
  const {
    currentBalance,
    rules,
    overrides = new Map(),
    windowDays = 60,
    referenceDate = new Date(),
  } = input;

  const today = startOfDay(referenceDate);
  const windowEnd = addDays(today, windowDays);

  // Build a map of date → {income, expenses} from all rules
  const dayMap = new Map<string, { income: number; expenses: number }>();

  for (const rule of rules) {
    const ruleOverrides = overrides.get(rule.id) ?? new Map();
    const occurrences = expandOccurrences(rule, today, windowEnd, ruleOverrides);

    for (const occ of occurrences) {
      const key = format(occ.date, "yyyy-MM-dd");
      const existing = dayMap.get(key) ?? { income: 0, expenses: 0 };

      if (rule.type === "income") {
        existing.income += occ.amount;
      } else {
        existing.expenses += occ.amount;
      }
      dayMap.set(key, existing);
    }
  }

  const days: DayProjection[] = [];
  const overdraftDays: string[] = [];
  let runningBalance = currentBalance;

  for (let i = 0; i <= windowDays; i++) {
    const d = addDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const { income, expenses } = dayMap.get(key) ?? { income: 0, expenses: 0 };

    runningBalance = runningBalance + income - expenses;

    days.push({ date: key, balance: Math.round(runningBalance * 100) / 100, income, expenses });

    if (runningBalance < 0) overdraftDays.push(key);
  }

  const getBalance = (daysOut: number) =>
    days[Math.min(daysOut, days.length - 1)]?.balance ?? currentBalance;

  return {
    days,
    balanceAt7: getBalance(7),
    balanceAt14: getBalance(14),
    balanceAt30: getBalance(30),
    overdraftDays,
  };
}
