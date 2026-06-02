import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError(401, "Unauthorized");
  const householdId = (session as any).householdId as string | null;
  const memberId = (session as any).memberId as string | null;
  if (!householdId) throw new ApiError(401, "No household — complete setup first");
  return { userId: session.user.id, householdId, memberId };
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
