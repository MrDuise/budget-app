import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const existing = await db.user.findFirst({ where: { email: "test@example.com" } });
  if (existing) {
    console.log("Seed data already exists, skipping.");
    return;
  }

  const password = await bcrypt.hash("password123", 12);
  const user = await db.user.create({
    data: { name: "Test User", email: "test@example.com", password },
  });

  const household = await db.household.create({ data: { name: "Test Household" } });

  const member = await db.householdMember.create({
    data: { householdId: household.id, userId: user.id, role: "owner" },
  });

  await db.category.createMany({
    data: [
      { householdId: household.id, name: "Rent / Mortgage", type: "FIXED_BILL", isSystem: true, color: "#ef4444" },
      { householdId: household.id, name: "Utilities", type: "VARIABLE_RECURRING", isSystem: true, color: "#f97316" },
      { householdId: household.id, name: "Groceries", type: "VARIABLE_REGULAR", isSystem: true, color: "#22c55e" },
      { householdId: household.id, name: "Dining Out", type: "VARIABLE_REGULAR", isSystem: true, color: "#a855f7" },
      { householdId: household.id, name: "Transportation", type: "VARIABLE_REGULAR", isSystem: true, color: "#3b82f6" },
      { householdId: household.id, name: "Savings", type: "SAVINGS", isSystem: true, color: "#84cc16" },
      { householdId: household.id, name: "Unplanned", type: "UNPLANNED", isSystem: true, color: "#6b7280" },
      { householdId: household.id, name: "Income", type: "FIXED_BILL", isSystem: true, color: "#10b981" },
    ],
  });

  const account = await db.account.create({
    data: {
      householdId: household.id,
      memberId: member.id,
      name: "Checking",
      type: "checking",
      currentBalance: 2500,
    },
  });

  console.log("Seed complete:", { user: user.email, household: household.name, account: account.name });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
