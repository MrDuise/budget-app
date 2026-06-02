import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";

const patchSchema = z.object({
  amount: z.number().positive().optional(),
  period: z.string().optional(),
});

async function getBudget(id: string, householdId: string) {
  const budget = await db.budget.findUnique({ where: { id } });
  if (!budget || budget.householdId !== householdId) throw new ApiError(404, "Budget limit not found");
  return budget;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getBudget(params.id, householdId);
    const body = patchSchema.parse(await req.json());
    const updated = await db.budget.update({ where: { id: params.id }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getBudget(params.id, householdId);
    await db.budget.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
