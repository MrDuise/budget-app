import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeArchive } from "../archive";

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

const mockFindUnique = db.transaction.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = db.transaction.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

const baseTx = {
  id: "tx1",
  isFinite: true,
  status: "pending",
  intervalDays: null as number | null,
  maxOccurrences: null as number | null,
  specificDate: null as Date | null,
  endDate: null as Date | null,
  scheduleDates: [] as { date: Date; status: string }[],
  occurrenceOverrides: [] as { occurrenceDate: Date; status: string }[],
};

describe("maybeArchive", () => {
  it("does nothing when transaction is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when isFinite is false", async () => {
    mockFindUnique.mockResolvedValue({ ...baseTx, isFinite: false });
    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when already archived", async () => {
    mockFindUnique.mockResolvedValue({ ...baseTx, status: "archived" });
    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when totalExpected is 0 (no schedule and no interval)", async () => {
    mockFindUnique.mockResolvedValue({ ...baseTx });
    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("archives when all scheduleDates are paid or skipped", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      scheduleDates: [
        { date: d(2024, 1, 15), status: "pending" },
        { date: d(2024, 2, 15), status: "pending" },
      ],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 15), status: "paid" },
        { occurrenceDate: d(2024, 2, 15), status: "skipped" },
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tx1" },
      data: { status: "archived" },
    });
  });

  it("does not archive when only some scheduleDates are covered", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      scheduleDates: [
        { date: d(2024, 1, 15), status: "pending" },
        { date: d(2024, 2, 15), status: "pending" },
      ],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 15), status: "paid" },
        // Feb 15 not yet handled
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("archives when maxOccurrences occurrences are all paid/skipped", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      intervalDays: 7,
      maxOccurrences: 3,
      specificDate: d(2024, 1, 1),
      scheduleDates: [],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 1), status: "paid" },
        { occurrenceDate: d(2024, 1, 8), status: "paid" },
        { occurrenceDate: d(2024, 1, 15), status: "skipped" },
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tx1" },
      data: { status: "archived" },
    });
  });

  it("does not archive when maxOccurrences not yet reached", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      intervalDays: 7,
      maxOccurrences: 4,
      specificDate: d(2024, 1, 1),
      scheduleDates: [],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 1), status: "paid" },
        { occurrenceDate: d(2024, 1, 8), status: "paid" },
        // 2 done out of 4
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("archives when endDate-based occurrences are all done", async () => {
    // Jan 1, 8, 15, 22 = 4 occurrences within endDate Jan 22
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      intervalDays: 7,
      specificDate: d(2024, 1, 1),
      endDate: d(2024, 1, 22),
      scheduleDates: [],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 1), status: "paid" },
        { occurrenceDate: d(2024, 1, 8), status: "paid" },
        { occurrenceDate: d(2024, 1, 15), status: "paid" },
        { occurrenceDate: d(2024, 1, 22), status: "paid" },
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tx1" },
      data: { status: "archived" },
    });
  });

  it("counts both paid and skipped as terminal (mixed case)", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseTx,
      intervalDays: 7,
      maxOccurrences: 3,
      specificDate: d(2024, 1, 1),
      scheduleDates: [],
      occurrenceOverrides: [
        { occurrenceDate: d(2024, 1, 1), status: "paid" },
        { occurrenceDate: d(2024, 1, 8), status: "skipped" },
        { occurrenceDate: d(2024, 1, 15), status: "paid" },
      ],
    });

    await maybeArchive("tx1");
    expect(mockUpdate).toHaveBeenCalled();
  });
});
