import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";
import { generateReport, type ReportTransaction } from "@/lib/reports";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  try {
    const { householdId } = await requireSession();
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const filterMemberId = url.searchParams.get("memberId");

    if (!fromParam || !toParam) throw new ApiError(400, "from and to query params are required");

    const from = startOfDay(parseISO(fromParam));
    const to = endOfDay(parseISO(toParam));

    const [transactions, budgets] = await Promise.all([
      db.transaction.findMany({
        where: {
          householdId,
          ...(filterMemberId ? { memberId: filterMemberId } : {}),
        },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
      db.budget.findMany({
        where: { householdId },
        include: { category: true },
      }),
    ]);

    const reportTxs: ReportTransaction[] = transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      categoryId: t.categoryId,
      categoryName: t.category.name,
      categoryType: t.category.type,
      date: t.specificDate ?? t.createdAt,
      name: t.name,
    }));

    const budgetLimits = budgets.map((b) => ({ categoryId: b.categoryId, amount: b.amount }));
    const result = generateReport(reportTxs, budgetLimits, from, to);

    return NextResponse.json({ ...result, transactions: reportTxs, from: from.toISOString(), to: to.toISOString() });
  } catch (err) {
    return apiError(err);
  }
}
