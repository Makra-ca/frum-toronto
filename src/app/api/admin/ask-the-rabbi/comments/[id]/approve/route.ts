import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiComments, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Auth guard: admin or canManageAskTheRabbi
async function isAuthorized(session: import("next-auth").Session | null) {
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;

  const [dbUser] = await db
    .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .limit(1);

  return dbUser?.canManageAskTheRabbi === true;
}

// POST /api/admin/ask-the-rabbi/comments/[id]/approve
// Approve a pending comment
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const commentId = parseInt(id);

    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const [updated] = await db
      .update(askTheRabbiComments)
      .set({ approvalStatus: "approved", updatedAt: new Date() })
      .where(eq(askTheRabbiComments.id, commentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error approving comment:", error);
    return NextResponse.json({ error: "Failed to approve comment" }, { status: 500 });
  }
}
