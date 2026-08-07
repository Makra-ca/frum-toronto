import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logAudit, getIpFromRequest } from "@/lib/audit";

const updateCommentSchema = z.object({
  approvalStatus: z.enum(["pending", "approved", "rejected"]),
});

// PATCH - Update comment approval status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const commentId = parseInt(id);
    const body = await request.json();

    const result = updateCommentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [previous] = await db
      .select({ approvalStatus: blogComments.approvalStatus })
      .from(blogComments)
      .where(eq(blogComments.id, commentId))
      .limit(1);

    const [updated] = await db
      .update(blogComments)
      .set({
        approvalStatus: result.data.approvalStatus,
        updatedAt: new Date(),
      })
      .where(eq(blogComments.id, commentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Moderation had no audit trail at all. It matters more now that Blocked
    // actually works: a comment can vanish and nothing recorded who did it.
    await logAudit({
      actorId: parseInt(session.user.id!),
      actorEmail: session.user.email ?? "unknown",
      action: result.data.approvalStatus === "approved" ? "APPROVE" : "REJECT",
      entityType: "blog_comment",
      entityId: commentId,
      entityTitle: updated.content.slice(0, 120),
      changes: {
        approvalStatus: {
          before: previous?.approvalStatus ?? null,
          after: result.data.approvalStatus,
        },
      },
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating blog comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

// DELETE - soft delete, so replies beneath the comment survive as a thread.
// This was a bare DELETE with no reply handling at all, which ORPHANED every
// reply: they matched no parent and were not top-level, so CommentThread
// rendered them nowhere while they stayed in the table forever.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const commentId = parseInt(id);

    const [deleted] = await db
      .update(blogComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(blogComments.id, commentId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    await logAudit({
      actorId: parseInt(session.user.id!),
      actorEmail: session.user.email ?? "unknown",
      action: "DELETE",
      entityType: "blog_comment",
      entityId: commentId,
      // The text is about to stop being visible anywhere; the log is the only
      // place left that records what was removed.
      entityTitle: deleted.content.slice(0, 120),
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting blog comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
