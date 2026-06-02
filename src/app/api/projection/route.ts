import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";
import { project } from "@/lib/projection";
import { toTransactionRules, toOverrideMap } from "@/lib/db-to-rules";

export async function GET(req: Request) {
  try {
    const { householdId } = await requireSession();
    const url = new URL(req.url);
    const windowDays = parseInt(url.searchParams.get("days") ?? "60", 10);
    const memberId = url.searchParams.get("memberId");

    const accounts = await db.account.findMany({
      where: { householdId, includeInTotal: true },
    });
    const currentBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const transactions = await db.transaction.findMany({
      where: {
        householdId,
        status: { not: "archived" },
        ...(memberId ? { memberId } : {}),
      },
      include: { category: true, scheduleDates: true },
    });

    const overrides = await db.occurrenceOverride.findMany({
      where: { transactionId: { in: transactions.map((t) => t.id) } },
    });

    const rules = toTransactionRules(transactions);
    const overrideMap = toOverrideMap(overrides);

    const result = project({ currentBalance, rules, overrides: overrideMap, windowDays });

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
