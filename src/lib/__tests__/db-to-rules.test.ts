import { describe, it, expect } from "vitest";
import { toTransactionRules, toOverrideMap } from "../db-to-rules";

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

const baseTx = {
  id: "tx1",
  type: "expense",
  amount: 500,
  estimatedAmount: null,
  status: "pending",
  isRecurring: true,
  recurrencePattern: "monthly" as string | null,
  dueDay: 15 as number | null,
  specificDate: null as Date | null,
  isFinite: false,
  intervalDays: null as number | null,
  maxOccurrences: null as number | null,
  endDate: null as Date | null,
  categoryId: "cat1",
};

describe("toTransactionRules", () => {
  it("maps all fields from a DB transaction correctly", () => {
    const rules = toTransactionRules([
      {
        ...baseTx,
        category: { type: "FIXED_BILL" },
        scheduleDates: [{ date: d(2024, 1, 15), status: "pending" }],
      },
    ]);

    expect(rules).toHaveLength(1);
    const r = rules[0];
    expect(r.id).toBe("tx1");
    expect(r.type).toBe("expense");
    expect(r.amount).toBe(500);
    expect(r.isRecurring).toBe(true);
    expect(r.recurrencePattern).toBe("monthly");
    expect(r.dueDay).toBe(15);
    expect(r.categoryType).toBe("FIXED_BILL");
    expect(r.scheduleDates).toHaveLength(1);
  });

  it("uses category.type for categoryType", () => {
    const [rule] = toTransactionRules([
      { ...baseTx, category: { type: "VARIABLE_RECURRING" }, scheduleDates: [] },
    ]);
    expect(rule.categoryType).toBe("VARIABLE_RECURRING");
  });

  it("defaults categoryType to null when category is null", () => {
    const [rule] = toTransactionRules([{ ...baseTx, category: null, scheduleDates: [] }]);
    expect(rule.categoryType).toBeNull();
  });

  it("defaults scheduleDates to empty array when undefined", () => {
    const [rule] = toTransactionRules([{ ...baseTx, category: null }]);
    expect(rule.scheduleDates).toEqual([]);
  });

  it("passes through estimatedAmount correctly", () => {
    const [rule] = toTransactionRules([{ ...baseTx, estimatedAmount: 120, category: null }]);
    expect(rule.estimatedAmount).toBe(120);
  });

  it("handles multiple transactions independently", () => {
    const rules = toTransactionRules([
      { ...baseTx, id: "a", category: null },
      { ...baseTx, id: "b", amount: 200, category: { type: "SAVINGS" } },
    ]);
    expect(rules[0].id).toBe("a");
    expect(rules[1].id).toBe("b");
    expect(rules[1].amount).toBe(200);
    expect(rules[1].categoryType).toBe("SAVINGS");
  });
});

describe("toOverrideMap", () => {
  it("returns empty map for no overrides", () => {
    const map = toOverrideMap([]);
    expect(map.size).toBe(0);
  });

  it("groups overrides by transactionId", () => {
    const overrides = [
      { transactionId: "tx1", occurrenceDate: d(2024, 1, 15), status: "skipped", newDate: null, actualAmount: null },
      { transactionId: "tx2", occurrenceDate: d(2024, 2, 1), status: "paid", newDate: null, actualAmount: 80 },
    ];
    const map = toOverrideMap(overrides);
    expect(map.has("tx1")).toBe(true);
    expect(map.has("tx2")).toBe(true);
    expect(map.get("tx1")!.size).toBe(1);
  });

  it("uses yyyy-MM-dd as the inner date key", () => {
    const overrides = [
      { transactionId: "tx1", occurrenceDate: new Date("2024-03-15T00:00:00.000Z"), status: "skipped", newDate: null, actualAmount: null },
    ];
    const map = toOverrideMap(overrides);
    const inner = map.get("tx1")!;
    // Key must be 10-char date string
    const key = Array.from(inner.keys())[0];
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("stores status, newDate, and actualAmount on the override value", () => {
    const newDate = d(2024, 1, 20);
    const overrides = [
      { transactionId: "tx1", occurrenceDate: d(2024, 1, 15), status: "paid", newDate, actualAmount: 143 },
    ];
    const map = toOverrideMap(overrides);
    const inner = map.get("tx1")!;
    const value = Array.from(inner.values())[0];
    expect(value.status).toBe("paid");
    expect(value.newDate).toBe(newDate);
    expect(value.actualAmount).toBe(143);
  });

  it("multiple overrides for same transaction build correct inner Map", () => {
    const overrides = [
      { transactionId: "tx1", occurrenceDate: d(2024, 1, 1), status: "paid", newDate: null, actualAmount: null },
      { transactionId: "tx1", occurrenceDate: d(2024, 2, 1), status: "skipped", newDate: null, actualAmount: null },
      { transactionId: "tx1", occurrenceDate: d(2024, 3, 1), status: "paid", newDate: null, actualAmount: 50 },
    ];
    const map = toOverrideMap(overrides);
    expect(map.get("tx1")!.size).toBe(3);
  });
});
