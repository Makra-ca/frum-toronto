import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiComments, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

const patchSchema = z.object({
  approvalStatus: z.enum(["approved", "pending", "rejected"]).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/admin/ask-the-rabbi/comments/[id]
// Update approvalStatus and/or isActive on a comment
export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const result = patchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (result.data.approvalStatus !== undefined) {
      updates.approvalStatus = result.data.approvalStatus;
    }
    if (result.data.isActive !== undefined) {
      updates.isActive = result.data.isActive;
    }

    const [updated] = await db
      .update(askTheRabbiComments)
      .set(updates)
      .where(eq(askTheRabbiComments.id, commentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error updating comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

// DELETE /api/admin/ask-the-rabbi/comments/[id]
// Soft delete — sets isActive = false
export async function DELETE(
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
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(askTheRabbiComments.id, commentId))
      .returning({ id: askTheRabbiComments.id });

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
