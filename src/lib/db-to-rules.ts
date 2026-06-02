import { type TransactionRule } from "@/lib/recurrence";

type DbTransaction = {
  id: string;
  type: string;
  amount: number;
  estimatedAmount: number | null;
  status: string;
  isRecurring: boolean;
  recurrencePattern: string | null;
  dueDay: number | null;
  specificDate: Date | null;
  isFinite: boolean;
  intervalDays: number | null;
  maxOccurrences: number | null;
  endDate: Date | null;
  categoryId: string;
  category?: { type: string } | null;
  scheduleDates?: { date: Date; status: string }[];
};

export function toTransactionRules(transactions: DbTransaction[]): TransactionRule[] {
  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    estimatedAmount: t.estimatedAmount,
    status: t.status,
    isRecurring: t.isRecurring,
    recurrencePattern: t.recurrencePattern,
    dueDay: t.dueDay,
    specificDate: t.specificDate,
    isFinite: t.isFinite,
    intervalDays: t.intervalDays,
    maxOccurrences: t.maxOccurrences,
    endDate: t.endDate,
    categoryType: t.category?.type ?? null,
    scheduleDates: t.scheduleDates ?? [],
  }));
}

type DbOverride = {
  transactionId: string;
  occurrenceDate: Date;
  status: string;
  newDate: Date | null;
  actualAmount: number | null;
};

export function toOverrideMap(
  overrides: DbOverride[]
): Map<string, Map<string, { status: string; newDate?: Date | null; actualAmount?: number | null }>> {
  const map = new Map<
    string,
    Map<string, { status: string; newDate?: Date | null; actualAmount?: number | null }>
  >();

  for (const o of overrides) {
    const key = o.occurrenceDate.toISOString().slice(0, 10);
    if (!map.has(o.transactionId)) map.set(o.transactionId, new Map());
    map.get(o.transactionId)!.set(key, {
      status: o.status,
      newDate: o.newDate,
      actualAmount: o.actualAmount,
    });
  }

  return map;
}
