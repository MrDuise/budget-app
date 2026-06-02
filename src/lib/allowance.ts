import { startOfDay, endOfMonth, differenceInDays, addDays, format } from "date-fns";
import { expandOccurrences, type TransactionRule } from "./recurrence";

export interface AllowanceInput {
  currentBalance: number;
  rules: TransactionRule[];
  alreadySpentThisMonth: number;
  overrides?: Map<string, Map<string, { status: string; newDate?: Date | null; actualAmount?: number | null }>>;
  referenceDate?: Date;
}

export interface AllowanceResult {
  dailyAllowance: number;
  daysRemaining: number;
  projectedIncome: number;
  fixedObligations: number;
  variableEstimates: number;
  alreadySpent: number;
  spendableRemaining: number;
}

export function computeAllowance(input: AllowanceInput): AllowanceResult {
  const { currentBalance, rules, alreadySpentThisMonth, overrides = new Map(), referenceDate = new Date() } = input;

  const today = startOfDay(referenceDate);
  const monthEnd = endOfMonth(today);
  const daysRemaining = Math.max(1, differenceInDays(addDays(monthEnd, 1), today));

  let projectedIncome = 0;
  let fixedObligations = 0;
  let variableEstimates = 0;

  for (const rule of rules) {
    const ruleOverrides = overrides.get(rule.id) ?? new Map();
    const occurrences = expandOccurrences(rule, today, monthEnd, ruleOverrides);

    for (const occ of occurrences) {
      if (rule.type === "income") {
        projectedIncome += occ.amount;
      } else if (rule.type === "expense") {
        const categoryType = (rule as any).categoryType as string | undefined;
        if (categoryType === "FIXED_BILL") {
          fixedObligations += occ.amount;
        } else {
          variableEstimates += occ.amount;
        }
      }
    }
  }

  const spendableRemaining = Math.max(
    0,
    currentBalance + projectedIncome - fixedObligations - variableEstimates - alreadySpentThisMonth
  );

  const dailyAllowance = Math.round((spendableRemaining / daysRemaining) * 100) / 100;

  return {
    dailyAllowance,
    daysRemaining,
    projectedIncome,
    fixedObligations,
    variableEstimates,
    alreadySpent: alreadySpentThisMonth,
    spendableRemaining,
  };
}
