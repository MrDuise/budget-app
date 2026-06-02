import { describe, it, expect } from "vitest";
import { expandOccurrences, type TransactionRule } from "../recurrence";

const base: TransactionRule = {
  id: "t1",
  isRecurring: true,
  isFinite: false,
  amount: 100,
  status: "pending",
};

const window = (start: string, end: string) => ({
  start: new Date(start),
  end: new Date(end),
});

describe("expandOccurrences", () => {
  it("returns empty for archived transactions", () => {
    const rule = { ...base, status: "archived" };
    const { start, end } = window("2024-01-01", "2024-01-31");
    expect(expandOccurrences(rule, start, end)).toHaveLength(0);
  });

  it("monthly: generates occurrence on dueDay each month", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 15 };
    const { start, end } = window("2024-01-01", "2024-03-31");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(3);
    expect(occurrences[0].date.getDate()).toBe(15);
    expect(occurrences[0].date.getMonth()).toBe(0); // January
    expect(occurrences[2].date.getMonth()).toBe(2); // March
  });

  it("monthly: clamps to Feb 28 when dueDay=31", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 31 };
    const { start, end } = window("2024-02-01", "2024-02-29");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.getDate()).toBe(29); // 2024 is leap year
  });

  it("monthly: clamps Feb 29 on non-leap year to Feb 28", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 31 };
    const { start, end } = window("2023-02-01", "2023-02-28");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.getDate()).toBe(28);
  });

  it("weekly: generates every 7 days", () => {
    const rule = {
      ...base,
      recurrencePattern: "weekly",
      specificDate: new Date("2024-01-01"),
    };
    const { start, end } = window("2024-01-01", "2024-01-28");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(4);
  });

  it("biweekly: generates every 14 days", () => {
    const rule = {
      ...base,
      recurrencePattern: "biweekly",
      specificDate: new Date("2024-01-01"),
    };
    const { start, end } = window("2024-01-01", "2024-01-31");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(3); // Jan 1, Jan 15, Jan 29
  });

  it("once: returns single occurrence on specificDate", () => {
    const rule = {
      ...base,
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: new Date("2024-06-10"),
    };
    const { start, end } = window("2024-06-01", "2024-06-30");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date.toISOString().slice(0, 10)).toBe("2024-06-10");
  });

  it("once: returns nothing if date outside window", () => {
    const rule = {
      ...base,
      isRecurring: false,
      recurrencePattern: "once",
      specificDate: new Date("2024-07-10"),
    };
    const { start, end } = window("2024-06-01", "2024-06-30");
    expect(expandOccurrences(rule, start, end)).toHaveLength(0);
  });

  it("skips occurrences via overrides", () => {
    const rule = { ...base, recurrencePattern: "monthly", dueDay: 1 };
    const { start, end } = window("2024-01-01", "2024-03-31");
    const occurrenceDate = new Date("2024-02-01").toISOString();
    const overrides = new Map([[occurrenceDate, { status: "skipped" }]]);
    const occurrences = expandOccurrences(rule, start, end, overrides);
    expect(occurrences).toHaveLength(2);
  });

  it("finite interval: respects maxOccurrences", () => {
    const rule = {
      ...base,
      isRecurring: true,
      isFinite: true,
      intervalDays: 7,
      maxOccurrences: 4,
      specificDate: new Date("2024-01-01"),
    };
    const { start, end } = window("2024-01-01", "2024-12-31");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(4);
  });

  it("specific-dates plan: returns only listed dates", () => {
    const rule = {
      ...base,
      isFinite: true,
      scheduleDates: [
        { date: new Date("2024-01-15"), status: "pending" },
        { date: new Date("2024-01-30"), status: "pending" },
        { date: new Date("2024-03-01"), status: "pending" },
      ],
    };
    const { start, end } = window("2024-01-01", "2024-01-31");
    const occurrences = expandOccurrences(rule, start, end);
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].date.toISOString().slice(0, 10)).toBe("2024-01-15");
  });
});
