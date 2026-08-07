import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiComments, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logAudit, getIpFromRequest } from "@/lib/audit";

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

    const [previous] = await db
      .select({ approvalStatus: askTheRabbiComments.approvalStatus })
      .from(askTheRabbiComments)
      .where(eq(askTheRabbiComments.id, commentId))
      .limit(1);

    const [updated] = await db
      .update(askTheRabbiComments)
      .set(updates)
      .where(eq(askTheRabbiComments.id, commentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // This surface has a second class of moderator — canManageAskTheRabbi —
    // who is not an admin, so "who did this" is a real question here.
    await logAudit({
      actorId: parseInt(session!.user.id!),
      actorEmail: session!.user.email ?? "unknown",
      action:
        result.data.approvalStatus === "rejected" ? "REJECT" : "APPROVE",
      entityType: "atr_comment",
      entityId: commentId,
      entityTitle: updated.content.slice(0, 120),
      changes: {
        approvalStatus: {
          before: previous?.approvalStatus ?? null,
          after: updated.approvalStatus,
        },
      },
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error updating comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

// DELETE /api/admin/ask-the-rabbi/comments/[id]
// Soft delete. Stamps deleted_at rather than flipping is_active: is_active is
// an admin hide/show and says nothing about whether a thread beneath the
// comment should survive. See src/lib/comments/tombstone.ts.
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
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(askTheRabbiComments.id, commentId))
      .returning({
        id: askTheRabbiComments.id,
        content: askTheRabbiComments.content,
      });

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    await logAudit({
      actorId: parseInt(session!.user.id!),
      actorEmail: session!.user.email ?? "unknown",
      action: "DELETE",
      entityType: "atr_comment",
      entityId: commentId,
      entityTitle: updated.content.slice(0, 120),
      ipAddress: getIpFromRequest(_request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
