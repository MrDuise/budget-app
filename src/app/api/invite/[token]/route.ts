import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-auth";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  try {
    const member = await db.householdMember.findUnique({
      where: { inviteToken: params.token },
      include: { household: true },
    });

    if (!member || member.inviteUsed) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      householdName: member.household.name,
      memberId: member.id,
    });
  } catch (err) {
    return apiError(err);
  }
}
