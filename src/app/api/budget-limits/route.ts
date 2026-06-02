import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";

const createSchema = z.object({
  categoryId: z.string(),
  amount: z.number().positive(),
  period: z.string().default("monthly"),
  memberId: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const { householdId } = await requireSession();
    const budgets = await db.budget.findMany({
      where: { householdId },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(budgets);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { householdId } = await requireSession();
    const body = createSchema.parse(await req.json());

    const existing = await db.budget.findFirst({
      where: { householdId, categoryId: body.categoryId, memberId: body.memberId ?? null },
    });

    let budget;
    if (existing) {
      budget = await db.budget.update({
        where: { id: existing.id },
        data: { amount: body.amount, period: body.period },
      });
    } else {
      budget = await db.budget.create({
        data: { ...body, householdId, memberId: body.memberId ?? null },
      });
    }

    return NextResponse.json(budget, { status: existing ? 200 : 201 });
  } catch (err) {
    return apiError(err);
  }
}
