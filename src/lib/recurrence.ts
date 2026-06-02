import { addDays, addMonths, addWeeks, startOfDay, isAfter, isBefore, isEqual, getDaysInMonth, setDate } from "date-fns";

export type RecurrencePattern = "monthly" | "biweekly" | "weekly" | "once";

export interface TransactionRule {
  id: string;
  isRecurring: boolean;
  recurrencePattern?: string | null;
  dueDay?: number | null;
  specificDate?: Date | null;
  isFinite: boolean;
  intervalDays?: number | null;
  maxOccurrences?: number | null;
  endDate?: Date | null;
  scheduleDates?: Array<{ date: Date; status: string }>;
  amount: number;
  estimatedAmount?: number | null;
  status: string;
}

export interface Occurrence {
  transactionId: string;
  date: Date;
  amount: number;
  isEstimated: boolean;
}

function clampDayToMonth(day: number, year: number, month: number): Date {
  const maxDay = getDaysInMonth(new Date(year, month));
  return new Date(year, month, Math.min(day, maxDay));
}

export function expandOccurrences(
  rule: TransactionRule,
  windowStart: Date,
  windowEnd: Date,
  overrides: Map<string, { status: string; newDate?: Date | null; actualAmount?: number | null }> = new Map()
): Occurrence[] {
  if (rule.status === "archived") return [];

  const start = startOfDay(windowStart);
  const end = startOfDay(windowEnd);
  const results: Occurrence[] = [];

  const inWindow = (d: Date) =>
    (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));

  const amount = (rule.estimatedAmount ?? rule.amount);

  // Specific-dates payment plan
  if (rule.isFinite && rule.scheduleDates && rule.scheduleDates.length > 0) {
    for (const sd of rule.scheduleDates) {
      if (sd.status === "skipped") continue;
      const d = startOfDay(sd.date);
      if (inWindow(d)) {
        results.push({ transactionId: rule.id, date: d, amount, isEstimated: false });
      }
    }
    return results;
  }

  // Interval-based finite or infinite
  if (rule.isFinite && rule.intervalDays) {
    if (!rule.specificDate) return [];
    let anchor = startOfDay(rule.specificDate);
    let count = 0;
    while (true) {
      if (rule.maxOccurrences && count >= rule.maxOccurrences) break;
      if (rule.endDate && isAfter(anchor, startOfDay(rule.endDate))) break;
      if (inWindow(anchor)) {
        const key = anchor.toISOString();
        const override = overrides.get(key);
        if (!override || override.status !== "skipped") {
          const d = override?.newDate ? startOfDay(override.newDate) : anchor;
          results.push({ transactionId: rule.id, date: d, amount: override?.actualAmount ?? amount, isEstimated: false });
        }
      }
      anchor = addDays(anchor, rule.intervalDays);
      count++;
      if (isAfter(anchor, end) && !(rule.endDate && isBefore(rule.endDate, end))) break;
    }
    return results;
  }

  // Non-standard infinite interval
  if (!rule.isRecurring && rule.intervalDays && rule.specificDate) {
    let anchor = startOfDay(rule.specificDate);
    while (!isAfter(anchor, end)) {
      if (inWindow(anchor)) {
        results.push({ transactionId: rule.id, date: anchor, amount, isEstimated: false });
      }
      anchor = addDays(anchor, rule.intervalDays);
    }
    return results;
  }

  if (!rule.isRecurring) {
    if (rule.specificDate) {
      const d = startOfDay(rule.specificDate);
      if (inWindow(d)) results.push({ transactionId: rule.id, date: d, amount, isEstimated: false });
    }
    return results;
  }

  const pattern = rule.recurrencePattern as RecurrencePattern | undefined;

  if (pattern === "once") {
    if (rule.specificDate) {
      const d = startOfDay(rule.specificDate);
      if (inWindow(d)) results.push({ transactionId: rule.id, date: d, amount, isEstimated: false });
    }
    return results;
  }

  if (pattern === "monthly" && rule.dueDay) {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (!isAfter(cursor, end)) {
      const d = clampDayToMonth(rule.dueDay, cursor.getFullYear(), cursor.getMonth());
      if (inWindow(d)) {
        const key = d.toISOString();
        const override = overrides.get(key);
        if (!override || override.status !== "skipped") {
          const finalDate = override?.newDate ? startOfDay(override.newDate) : d;
          results.push({
            transactionId: rule.id,
            date: finalDate,
            amount: override?.actualAmount ?? amount,
            isEstimated: !!rule.estimatedAmount,
          });
        }
      }
      cursor = addMonths(cursor, 1);
    }
    return results;
  }

  if ((pattern === "biweekly" || pattern === "weekly") && rule.specificDate) {
    const step = pattern === "biweekly" ? 14 : 7;
    let anchor = startOfDay(rule.specificDate);
    // Rewind anchor to before or at window start
    while (isAfter(anchor, start)) anchor = addDays(anchor, -step);
    while (isBefore(anchor, start)) anchor = addDays(anchor, step);

    while (!isAfter(anchor, end)) {
      if (inWindow(anchor)) {
        const key = anchor.toISOString();
        const override = overrides.get(key);
        if (!override || override.status !== "skipped") {
          const finalDate = override?.newDate ? startOfDay(override.newDate) : anchor;
          results.push({
            transactionId: rule.id,
            date: finalDate,
            amount: override?.actualAmount ?? amount,
            isEstimated: false,
          });
        }
      }
      anchor = addDays(anchor, step);
    }
    return results;
  }

  return results;
}
