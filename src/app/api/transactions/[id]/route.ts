import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";

const patchSchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  visibility: z.enum(["personal", "shared"]).optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(["monthly", "biweekly", "weekly", "once"]).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  specificDate: z.string().datetime().nullable().optional(),
  isFinite: z.boolean().optional(),
  intervalDays: z.number().int().positive().nullable().optional(),
  maxOccurrences: z.number().int().positive().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  estimatedAmount: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["pending", "archived"]).optional(),
  scheduleDates: z.array(z.string().datetime()).optional(),
});

async function getTx(id: string, householdId: string) {
  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx || tx.householdId !== householdId) throw new ApiError(404, "Transaction not found");
  return tx;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    const tx = await getTx(params.id, householdId);
    return NextResponse.json(tx);
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getTx(params.id, householdId);
    const body = patchSchema.parse(await req.json());
    const { scheduleDates, specificDate, endDate, ...rest } = body;

    const updated = await db.$transaction(async (tx) => {
      if (scheduleDates !== undefined) {
        await tx.paymentScheduleDate.deleteMany({ where: { transactionId: params.id } });
        if (scheduleDates.length > 0) {
          await tx.paymentScheduleDate.createMany({
            data: scheduleDates.map((d) => ({
              transactionId: params.id,
              date: new Date(d),
            })),
          });
        }
      }

      return tx.transaction.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(specificDate !== undefined ? { specificDate: specificDate ? new Date(specificDate) : null } : {}),
          ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        },
        include: { scheduleDates: true, occurrenceOverrides: true },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getTx(params.id, householdId);
    await db.transaction.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
