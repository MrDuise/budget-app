import { describe, it, expect } from "vitest";
import { expandOccurrences, type TransactionRule } from "../recurrence";

const base: TransactionRule = {
  id: "t1",
  type: "expense",
  isRecurring: true,
  isFinite: false,
  amount: 100,
  status: "pending",
};

// Use local midnight dates (not ISO string parsing) to avoid UTC offset issues
const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe("expandOccurrences", () => {
  it("returns empty for archived transactions", () => {
    const rule = { ...base, status: "archived" };
    expect(expandOccurrences(rule, d(2024, 1, 1), d(2024, 1, 31))).toHaveLength(0);
  });

  it("monthly: generates occurrence on dueDay each month", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 15 };
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 3, 31));
    expect(occurrences).toHaveLength(3);
    expect(occurrences[0].date.getDate()).toBe(15);
    expect(occurrences[0].date.getMonth()).toBe(0); // January
    expect(occurrences[2].date.getMonth()).toBe(2); // March
  });

  it("monthly: clamps to Feb 29 on leap year when dueDay=31", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 31 };
    const occurrences = expandOccurrences(rule, d(2024, 2, 1), d(2024, 2, 29));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.getDate()).toBe(29); // 2024 is leap year
  });

  it("monthly: clamps to Feb 28 on non-leap year when dueDay=31", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 31 };
    const occurrences = expandOccurrences(rule, d(2023, 2, 1), d(2023, 2, 28));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.getDate()).toBe(28);
  });

  it("weekly: generates every 7 days", () => {
    const rule = { ...base, recurrencePattern: "weekly", specificDate: d(2024, 1, 1) };
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 1, 28));
    expect(occurrences).toHaveLength(4);
  });

  it("biweekly: generates every 14 days", () => {
    const rule = { ...base, recurrencePattern: "biweekly", specificDate: d(2024, 1, 1) };
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 1, 31));
    // Jan 1, Jan 15, Jan 29 = 3
    expect(occurrences).toHaveLength(3);
  });

  it("once: returns single occurrence on specificDate", () => {
    const rule = {
      ...base,
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 6, 10),
    };
    const occurrences = expandOccurrences(rule, d(2024, 6, 1), d(2024, 6, 30));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.getDate()).toBe(10);
    expect(occurrences[0].date.getMonth()).toBe(5); // June = month index 5
  });

  it("once: returns nothing if date outside window", () => {
    const rule = {
      ...base,
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: d(2024, 7, 10),
    };
    expect(expandOccurrences(rule, d(2024, 6, 1), d(2024, 6, 30))).toHaveLength(0);
  });

  it("skips occurrences via overrides", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 1 };
    // Override key must match dateKey() format: "yyyy-MM-dd"
    const overrides = new Map([["2024-02-01", { status: "skipped" }]]);
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 3, 31), overrides);
    expect(occurrences).toHaveLength(2); // Jan and Mar; Feb skipped
  });

  it("finite interval: respects maxOccurrences", () => {
    const rule = {
      ...base,
      isFinite: true,
      intervalDays: 7,
      maxOccurrences: 4,
      specificDate: d(2024, 1, 1),
    };
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 12, 31));
    expect(occurrences).toHaveLength(4);
  });

  it("specific-dates plan: returns only listed dates in window", () => {
    const rule = {
      ...base,
      isFinite: true,
      scheduleDates: [
        { date: d(2024, 1, 15), status: "pending" },
        { date: d(2024, 1, 30), status: "pending" },
        { date: d(2024, 3, 1), status: "pending" },
      ],
    };
    const occurrences = expandOccurrences(rule, d(2024, 1, 1), d(2024, 1, 31));
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].date.getDate()).toBe(15);
    expect(occurrences[1].date.getDate()).toBe(30);
  });
});
