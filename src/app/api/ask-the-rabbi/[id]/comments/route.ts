import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbi, askTheRabbiComments, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be 2000 characters or less"),
  parentId: z.number().int().positive().nullable().optional(),
});

// GET /api/ask-the-rabbi/[id]/comments
// Public — returns approved, active comments for a published question
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    // Verify the question exists and is published
    const [question] = await db
      .select({ id: askTheRabbi.id })
      .from(askTheRabbi)
      .where(and(eq(askTheRabbi.id, questionId), eq(askTheRabbi.isPublished, true)))
      .limit(1);

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const comments = await db
      .select({
        id: askTheRabbiComments.id,
        authorId: askTheRabbiComments.authorId,
        content: askTheRabbiComments.content,
        parentId: askTheRabbiComments.parentId,
        approvalStatus: askTheRabbiComments.approvalStatus,
        createdAt: askTheRabbiComments.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(askTheRabbiComments)
      .leftJoin(users, eq(askTheRabbiComments.authorId, users.id))
      .where(
        and(
          eq(askTheRabbiComments.questionId, questionId),
          eq(askTheRabbiComments.approvalStatus, "approved"),
          eq(askTheRabbiComments.isActive, true)
        )
      )
      .orderBy(asc(askTheRabbiComments.createdAt));

    const mapped = comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      content: c.content,
      parentId: c.parentId,
      approvalStatus: c.approvalStatus,
      createdAt: c.createdAt,
      authorName:
        [c.authorFirstName, c.authorLastName].filter(Boolean).join(" ") || "Anonymous",
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("[ATR COMMENTS] Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST /api/ask-the-rabbi/[id]/comments
// Auth required — submit a comment on a published question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const questionId = parseInt(id);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    // Verify the question exists and is published
    const [question] = await db
      .select({ id: askTheRabbi.id })
      .from(askTheRabbi)
      .where(and(eq(askTheRabbi.id, questionId), eq(askTheRabbi.isPublished, true)))
      .limit(1);

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = commentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, parentId } = result.data;

    // Fetch the full user record for commentPermission and canManageAskTheRabbi
    const userId = parseInt(session.user.id);
    const [dbUser] = await db
      .select({
        commentPermission: users.commentPermission,
        canManageAskTheRabbi: users.canManageAskTheRabbi,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isManager =
      session.user.role === "admin" || dbUser?.canManageAskTheRabbi === true;

    // Check commentPermission (managers always bypass this)
    if (!isManager) {
      const permission = dbUser?.commentPermission ?? "allowed";
      if (permission === "blocked") {
        return NextResponse.json(
          { error: "You are not permitted to comment." },
          { status: 403 }
        );
      }
    }

    // Validate parentId if provided — must be a top-level comment on this question
    if (parentId) {
      const [parentComment] = await db
        .select({
          id: askTheRabbiComments.id,
          parentId: askTheRabbiComments.parentId,
        })
        .from(askTheRabbiComments)
        .where(
          and(
            eq(askTheRabbiComments.id, parentId),
            eq(askTheRabbiComments.questionId, questionId),
            eq(askTheRabbiComments.isActive, true)
          )
        )
        .limit(1);

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 400 }
        );
      }

      if (parentComment.parentId !== null) {
        return NextResponse.json(
          { error: "Cannot reply to a reply. Maximum nesting depth is 1." },
          { status: 400 }
        );
      }
    }

    // Determine approval status
    let approvalStatus = "approved";
    if (!isManager) {
      const permission = dbUser?.commentPermission ?? "allowed";
      if (permission === "moderated" || permission === "requires_approval") {
        approvalStatus = "pending";
      }
    }

    const [newComment] = await db
      .insert(askTheRabbiComments)
      .values({
        questionId,
        authorId: userId,
        content: content.trim(),
        parentId: parentId ?? null,
        approvalStatus,
      })
      .returning();

    const authorName =
      [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(" ") || "Anonymous";

    return NextResponse.json(
      {
        id: newComment.id,
        content: newComment.content,
        parentId: newComment.parentId,
        approvalStatus: newComment.approvalStatus,
        createdAt: newComment.createdAt,
        authorName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ATR COMMENTS] Error creating comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

// DELETE /api/ask-the-rabbi/[id]/comments?commentId=xxx
// Users can delete their own comments; admins/ATR managers can delete any (with cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const questionId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("commentId") || "");

    if (isNaN(questionId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Check if user is an ATR manager (from DB, since JWT may lag on permission changes)
    let isManager = isAdmin || session.user.canManageAskTheRabbi;
    if (!isManager) {
      const [dbUser] = await db
        .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      isManager = dbUser?.canManageAskTheRabbi === true;
    }

    const [comment] = await db
      .select({ id: askTheRabbiComments.id, authorId: askTheRabbiComments.authorId, parentId: askTheRabbiComments.parentId })
      .from(askTheRabbiComments)
      .where(and(eq(askTheRabbiComments.id, commentId), eq(askTheRabbiComments.questionId, questionId)))
      .limit(1);

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (!isManager && comment.authorId !== userId) {
      return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
    }

    // If deleting a top-level comment, cascade-delete its replies first
    if (comment.parentId === null) {
      await db.delete(askTheRabbiComments).where(eq(askTheRabbiComments.parentId, commentId));
    }

    await db.delete(askTheRabbiComments).where(eq(askTheRabbiComments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ATR COMMENTS] Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
