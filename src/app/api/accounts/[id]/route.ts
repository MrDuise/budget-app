import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  currentBalance: z.number().optional(),
  includeInTotal: z.boolean().optional(),
  notes: z.string().optional(),
  memberId: z.string().nullable().optional(),
});

async function getAccount(id: string, householdId: string) {
  const account = await db.account.findUnique({ where: { id } });
  if (!account || account.householdId !== householdId) throw new ApiError(404, "Account not found");
  return account;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    const account = await getAccount(params.id, householdId);
    return NextResponse.json(account);
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getAccount(params.id, householdId);
    const body = patchSchema.parse(await req.json());

    const account = await db.$transaction(async (tx) => {
      if (body.currentBalance !== undefined) {
        await tx.balanceSnapshot.create({
          data: { accountId: params.id, balance: body.currentBalance },
        });
      }
      return tx.account.update({
        where: { id: params.id },
        data: { ...body, lastUpdated: new Date() },
      });
    });

    return NextResponse.json(account);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getAccount(params.id, householdId);
    await db.account.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
