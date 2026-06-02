import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";
import { maybeArchive } from "@/lib/archive";

const skipSchema = z.object({
  occurrenceDate: z.string().datetime(),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    const tx = await db.transaction.findUnique({ where: { id: params.id } });
    if (!tx || tx.householdId !== householdId) throw new ApiError(404, "Transaction not found");

    const body = skipSchema.parse(await req.json());
    const occurrenceDate = new Date(body.occurrenceDate);

    const override = await db.occurrenceOverride.upsert({
      where: { transactionId_occurrenceDate: { transactionId: params.id, occurrenceDate } },
      create: { transactionId: params.id, occurrenceDate, status: "skipped", note: body.note },
      update: { status: "skipped", note: body.note },
    });

    await maybeArchive(params.id);

    return NextResponse.json(override);
  } catch (err) {
    return apiError(err);
  }
}
