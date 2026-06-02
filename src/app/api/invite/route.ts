import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api-auth";

export async function POST() {
  try {
    const { householdId } = await requireSession();
    const token = crypto.randomUUID();

    // Create a placeholder member row that gets claimed when the invitee signs up
    const member = await db.householdMember.create({
      data: {
        householdId,
        userId: "pending", // will be replaced when the invite is accepted
        role: "member",
        inviteToken: token,
        inviteUsed: false,
      },
    });

    const url = `/invite/${token}`;
    return NextResponse.json({ token, url, memberId: member.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
