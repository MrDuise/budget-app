import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";
import { generateReport, type ReportTransaction } from "@/lib/reports";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(req: Request) {
  try {
    const { householdId, memberId } = await requireSession();
    const url = new URL(req.url);
    const filterMemberId = url.searchParams.get("memberId");
    const monthParam = url.searchParams.get("month"); // YYYY-MM

    let from: Date;
    let to: Date;
    if (monthParam) {
      const ref = parseISO(`${monthParam}-01`);
      from = startOfMonth(ref);
      to = endOfMonth(ref);
    } else {
      from = startOfMonth(new Date());
      to = endOfMonth(new Date());
    }

    const [transactions, budgets] = await Promise.all([
      db.transaction.findMany({
        where: {
          householdId,
          type: "expense",
          status: { not: "archived" },
          ...(filterMemberId ? { memberId: filterMemberId } : {}),
        },
        include: { category: true },
      }),
      db.budget.findMany({
        where: {
          householdId,
          ...(filterMemberId ? { memberId: filterMemberId } : { memberId: null }),
        },
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

    const budgetLimits = budgets.map((b) => ({
      categoryId: b.categoryId,
      amount: b.amount,
    }));

    const result = generateReport(reportTxs, budgetLimits, from, to);

    return NextResponse.json({ ...result, from: from.toISOString(), to: to.toISOString() });
  } catch (err) {
    return apiError(err);
  }
}
