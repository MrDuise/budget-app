import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "FIXED_BILL",
    "VARIABLE_RECURRING",
    "VARIABLE_REGULAR",
    "SHARED",
    "UNPLANNED",
    "PROJECTED_FUTURE",
    "SAVINGS",
    "INVESTMENT",
  ]),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET() {
  try {
    const { householdId } = await requireSession();
    const categories = await db.category.findMany({
      where: { householdId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(categories);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { householdId } = await requireSession();
    const body = createSchema.parse(await req.json());
    const category = await db.category.create({
      data: { ...body, householdId, isSystem: false },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
