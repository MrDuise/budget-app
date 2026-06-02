import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const setupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const existingUser = await db.user.findFirst();
    if (existingUser) {
      return NextResponse.json(
        { error: "An account already exists. Please log in or use an invite link." },
        { status: 409 }
      );
    }

    const { name, email, password } = parsed.data;
    const hashed = await bcrypt.hash(password, 12);

    const user = await db.user.create({ data: { name, email, password: hashed } });
    const household = await db.household.create({ data: { name: "My Budget" } });
    await db.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: "owner" },
    });

    await db.category.createMany({
      data: [
        { householdId: household.id, name: "Rent / Mortgage", type: "FIXED_BILL", isSystem: true, color: "#ef4444" },
        { householdId: household.id, name: "Utilities", type: "VARIABLE_RECURRING", isSystem: true, color: "#f97316" },
        { householdId: household.id, name: "Groceries", type: "VARIABLE_REGULAR", isSystem: true, color: "#22c55e" },
        { householdId: household.id, name: "Dining Out", type: "VARIABLE_REGULAR", isSystem: true, color: "#a855f7" },
        { householdId: household.id, name: "Transportation", type: "VARIABLE_REGULAR", isSystem: true, color: "#3b82f6" },
        { householdId: household.id, name: "Healthcare", type: "VARIABLE_REGULAR", isSystem: true, color: "#06b6d4" },
        { householdId: household.id, name: "Savings", type: "SAVINGS", isSystem: true, color: "#84cc16" },
        { householdId: household.id, name: "Unplanned", type: "UNPLANNED", isSystem: true, color: "#6b7280" },
        { householdId: household.id, name: "Income", type: "FIXED_BILL", isSystem: true, color: "#10b981" },
      ],
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[setup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
