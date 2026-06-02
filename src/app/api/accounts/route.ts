import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("checking"),
  currentBalance: z.number().default(0),
  includeInTotal: z.boolean().default(true),
  notes: z.string().optional(),
  memberId: z.string().optional(),
});

export async function GET() {
  try {
    const { householdId } = await requireSession();
    const accounts = await db.account.findMany({
      where: { householdId },
      include: { plaidAccount: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { householdId } = await requireSession();
    const body = createSchema.parse(await req.json());

    const account = await db.$transaction(async (tx) => {
      const acc = await tx.account.create({
        data: { ...body, householdId },
      });
      if (body.currentBalance !== 0) {
        await tx.balanceSnapshot.create({
          data: { accountId: acc.id, balance: body.currentBalance },
        });
      }
      return acc;
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
