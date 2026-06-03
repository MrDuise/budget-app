import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";

const createSchema = z.object({
  accountId: z.string(),
  categoryId: z.string(),
  name: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["income", "expense", "transfer"]).default("expense"),
  visibility: z.enum(["personal", "shared"]).default("personal"),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(["monthly", "biweekly", "weekly", "once"]).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  specificDate: z.string().datetime().optional(),
  isFinite: z.boolean().default(false),
  intervalDays: z.number().int().positive().optional(),
  maxOccurrences: z.number().int().positive().optional(),
  endDate: z.string().datetime().optional(),
  estimatedAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  memberId: z.string().optional(),
  scheduleDates: z.array(z.string().datetime()).optional(),
});

export async function GET(req: Request) {
  try {
    const { householdId, memberId: sessionMemberId } = await requireSession();
    const url = new URL(req.url);
    const filterMemberId = url.searchParams.get("memberId");
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const categoryId = url.searchParams.get("categoryId");
    const accountId = url.searchParams.get("accountId");

    const transactions = await db.transaction.findMany({
      where: {
        householdId,
        ...(filterMemberId ? { memberId: filterMemberId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(accountId ? { accountId } : {}),
        // Show personal transactions only for the current member
        OR: filterMemberId
          ? undefined
          : [
              { visibility: "shared" },
              { memberId: sessionMemberId },
              { memberId: null },
            ],
      },
      include: {
        category: true,
        occurrenceOverrides: true,
        scheduleDates: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { householdId, memberId } = await requireSession();
    const body = createSchema.parse(await req.json());
    const { scheduleDates, specificDate, endDate, ...rest } = body;

    const transaction = await db.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: rest.accountId, householdId } });
      if (!account) throw Object.assign(new Error("Account not found"), { status: 400 });

      const category = await tx.category.findFirst({ where: { id: rest.categoryId, householdId } });
      if (!category) throw Object.assign(new Error("Category not found"), { status: 400 });

      if (rest.memberId) {
        const member = await tx.householdMember.findFirst({ where: { id: rest.memberId, householdId } });
        if (!member) throw Object.assign(new Error("Member not found"), { status: 400 });
      }

      const created = await tx.transaction.create({
        data: {
          ...rest,
          householdId,
          memberId: rest.memberId ?? memberId,
          specificDate: specificDate ? new Date(specificDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        },
      });

      if (scheduleDates && scheduleDates.length > 0) {
        await tx.paymentScheduleDate.createMany({
          data: scheduleDates.map((d) => ({
            transactionId: created.id,
            date: new Date(d),
          })),
        });
      }

      return created;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
