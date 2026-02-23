import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ canSubmit: false, reason: "not_logged_in" });
    }

    const userId = parseInt(session.user.id);
    const [user] = await db
      .select({
        role: users.role,
        canAutoApproveShiurim: users.canAutoApproveShiurim,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canSubmit = user?.role === "admin" || user?.canAutoApproveShiurim;

    return NextResponse.json({
      canSubmit,
      reason: canSubmit ? "has_permission" : "no_permission"
    });
  } catch (error) {
    console.error("Error checking shiurim permission:", error);
    return NextResponse.json({ canSubmit: false, reason: "error" });
  }
}
