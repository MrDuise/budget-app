import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";
import { computeAllowance } from "@/lib/allowance";
import { toTransactionRules, toOverrideMap } from "@/lib/db-to-rules";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: Request) {
  try {
    const { householdId, memberId } = await requireSession();
    const url = new URL(req.url);
    const filterMemberId = url.searchParams.get("memberId") ?? memberId;

    const accounts = await db.account.findMany({
      where: { householdId, includeInTotal: true },
    });
    const currentBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const transactions = await db.transaction.findMany({
      where: {
        householdId,
        status: { not: "archived" },
        ...(filterMemberId ? { memberId: filterMemberId } : {}),
      },
      include: { category: true, scheduleDates: true },
    });

    const overrides = await db.occurrenceOverride.findMany({
      where: { transactionId: { in: transactions.map((t) => t.id) } },
    });

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const paidThisMonth = await db.occurrenceOverride.findMany({
      where: {
        status: "paid",
        occurrenceDate: { gte: monthStart, lte: monthEnd },
        transactionId: {
          in: transactions.filter((t) => t.type === "expense").map((t) => t.id),
        },
      },
    });

    const alreadySpentThisMonth = paidThisMonth.reduce(
      (sum, o) => sum + (o.actualAmount ?? 0),
      0
    );

    const rules = toTransactionRules(transactions);
    const overrideMap = toOverrideMap(overrides);

    const result = computeAllowance({
      currentBalance,
      rules,
      overrides: overrideMap,
      alreadySpentThisMonth,
    });

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
