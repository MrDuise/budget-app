import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError, ApiError } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z
    .enum([
      "FIXED_BILL",
      "VARIABLE_RECURRING",
      "VARIABLE_REGULAR",
      "SHARED",
      "UNPLANNED",
      "PROJECTED_FUTURE",
      "SAVINGS",
      "INVESTMENT",
    ])
    .optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

async function getCategory(id: string, householdId: string) {
  const cat = await db.category.findUnique({ where: { id } });
  if (!cat || cat.householdId !== householdId) throw new ApiError(404, "Category not found");
  return cat;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getCategory(params.id, householdId);
    const body = patchSchema.parse(await req.json());
    const updated = await db.category.update({ where: { id: params.id }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { householdId } = await requireSession();
    await getCategory(params.id, householdId);

    const txCount = await db.transaction.count({ where: { categoryId: params.id } });
    if (txCount > 0) {
      throw new ApiError(409, `Category has ${txCount} transaction(s). Reassign them first.`);
    }

    await db.category.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
