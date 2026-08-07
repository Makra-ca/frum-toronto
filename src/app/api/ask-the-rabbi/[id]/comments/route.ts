import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { applyTombstones } from "@/lib/comments/tombstone";
import { resolveCommentOutcome } from "@/lib/comments/resolve";
import {
  refuseCommentEdit,
  EDIT_REFUSAL_MESSAGES,
  EDIT_REFUSAL_STATUS,
} from "@/lib/comments/edit";
import { askTheRabbi, askTheRabbiComments, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import { canManageAtr } from "@/lib/auth/atr-permissions";

export const dynamic = "force-dynamic";

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be 2000 characters or less"),
  parentId: z.number().int().positive().nullable().optional(),
});

/** An edit changes the text and nothing else — never the parent or question. */
const commentEditSchema = commentSchema.pick({ content: true });

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
        deletedAt: askTheRabbiComments.deletedAt,
        editedAt: askTheRabbiComments.editedAt,
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

    // Deleted rows are fetched, not filtered in SQL: a deleted parent must
    // survive as a tombstone while its replies are live. Text and author are
    // blanked server-side, not hidden in the client.
    const mapped = applyTombstones(comments).map((c) => ({
      id: c.id,
      authorId: c.authorId,
      content: c.content,
      parentId: c.parentId,
      approvalStatus: c.approvalStatus,
      createdAt: c.createdAt,
      // Null on a tombstone: whether a removed comment was ever edited is
      // not something a reader needs, and it is one more fact about it.
      editedAt: c.isDeleted ? null : c.editedAt,
      isDeleted: c.isDeleted,
      authorName: c.isDeleted
        ? null
        : [c.authorFirstName, c.authorLastName].filter(Boolean).join(" ") ||
          "Anonymous",
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

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const { id } = await params;
    const questionId = parseInt(id);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    // Verify the question exists and is published
    const [question] = await db
      .select({ id: askTheRabbi.id, title: askTheRabbi.title })
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
        canAutoApproveAskTheRabbi: users.canAutoApproveAskTheRabbi,
        canManageAskTheRabbi: users.canManageAskTheRabbi,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isManager =
      session.user.role === "admin" || dbUser?.canManageAskTheRabbi === true;

    // The same resolution the EDIT path uses, so the two cannot diverge —
    // an edit that moderated differently from a create would be a hole, not an
    // inconsistency. Resolved before the parent lookup so a blocked request
    // does no further work.
    const outcome = await resolveCommentOutcome({
      userId,
      isAdmin: isManager,
      surface: "askTheRabbi",
      canSkipModeration: dbUser?.canAutoApproveAskTheRabbi === true,
    });

    if (outcome === "blocked") {
      return NextResponse.json(
        { error: "You are not permitted to comment." },
        { status: 403 }
      );
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

    const approvalStatus = outcome === "hold" ? "pending" : "approved";

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

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "atr_comment",
      title: `New Ask the Rabbi comment on "${question.title}"`,
      body:
        `Question: ${question.title}\n` +
        `By: ${authorName}\n\n` +
        content.trim(),
      linkUrl: "/admin/programs/rabbi?tab=comments",
      status: approvalStatus === "pending" ? "pending" : "auto_approved",
    });

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
// Users can delete their own comments; admins/ATR managers can delete any.
// Soft delete — see src/lib/comments/tombstone.ts for what a reader then sees.
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

    // The database fallback below used to run only when the token said `false`,
    // so a token saying `true` was never re-checked — REVOKING the capability
    // did not bite until that user's session refreshed. Deferring to the shared
    // helper, which always resolves from the database, closes it in the
    // direction that matters and keeps one definition of "ATR manager".
    const isManager = await canManageAtr(session);

    const [comment] = await db
      .select({
        id: askTheRabbiComments.id,
        authorId: askTheRabbiComments.authorId,
        parentId: askTheRabbiComments.parentId,
        // Needed for the audit entry: after this the text is shown nowhere.
        content: askTheRabbiComments.content,
      })
      .from(askTheRabbiComments)
      .where(and(eq(askTheRabbiComments.id, commentId), eq(askTheRabbiComments.questionId, questionId)))
      .limit(1);

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (!isManager && comment.authorId !== userId) {
      return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
    }

    // Soft delete. This used to hard-delete the comment AND every reply, so
    // deleting one's own comment destroyed other people's answers beneath it —
    // the worst case on this surface, where a reply is usually a standalone
    // answer to a halachic question.
    await db
      .update(askTheRabbiComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(askTheRabbiComments.id, commentId));


    // Audited only when someone removes a comment that is not theirs. A person
    // deleting their own is ordinary use; a moderator removing another
    // person's is an action that should be answerable for.
    if (comment.authorId !== userId) {
      await logAudit({
        actorId: userId,
        actorEmail: session.user.email ?? "unknown",
        action: "DELETE",
        entityType: "atr_comment",
        entityId: commentId,
        entityTitle: comment.content?.slice(0, 120) ?? null,
        ipAddress: getIpFromRequest(request),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ATR COMMENTS] Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

// PATCH /api/ask-the-rabbi/[id]/comments?commentId=xxx
//
// The author corrects their own comment. See the blog equivalent — same three
// rules, and note that admins and ATR managers are NOT exempt from the
// ownership check here. Moderating someone's words is theirs to do; rewriting
// them under that person's name is not.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const { id } = await params;
    const questionId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("commentId") || "");

    if (isNaN(questionId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = commentEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const [comment] = await db
      .select({
        id: askTheRabbiComments.id,
        authorId: askTheRabbiComments.authorId,
        content: askTheRabbiComments.content,
        deletedAt: askTheRabbiComments.deletedAt,
        approvalStatus: askTheRabbiComments.approvalStatus,
      })
      .from(askTheRabbiComments)
      .where(
        and(
          eq(askTheRabbiComments.id, commentId),
          eq(askTheRabbiComments.questionId, questionId)
        )
      )
      .limit(1);

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const userId = parseInt(session.user.id);
    const refusal = refuseCommentEdit(comment, userId);
    if (refusal) {
      return NextResponse.json(
        { error: EDIT_REFUSAL_MESSAGES[refusal] },
        { status: EDIT_REFUSAL_STATUS[refusal] }
      );
    }

    const [dbUser] = await db
      .select({ canAutoApproveAskTheRabbi: users.canAutoApproveAskTheRabbi })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const outcome = await resolveCommentOutcome({
      userId,
      isAdmin: await canManageAtr(session),
      surface: "askTheRabbi",
      canSkipModeration: dbUser?.canAutoApproveAskTheRabbi === true,
    });

    if (outcome === "blocked") {
      return NextResponse.json(
        { error: "You are not permitted to comment." },
        { status: 403 }
      );
    }

    const approvalStatus = outcome === "hold" ? "pending" : "approved";
    const wasPublic = comment.approvalStatus === "approved";

    const [updated] = await db
      .update(askTheRabbiComments)
      .set({
        content: parsed.data.content,
        editedAt: new Date(),
        approvalStatus,
        updatedAt: new Date(),
      })
      .where(eq(askTheRabbiComments.id, commentId))
      .returning();

    if (wasPublic) {
      await logAudit({
        actorId: userId,
        actorEmail: session.user.email ?? "unknown",
        action: "UPDATE",
        entityType: "atr_comment",
        entityId: commentId,
        entityTitle: parsed.data.content.slice(0, 120),
        changes: {
          content: { before: comment.content, after: parsed.data.content },
          approvalStatus: {
            before: comment.approvalStatus,
            after: approvalStatus,
          },
        },
        ipAddress: getIpFromRequest(request),
      });
    }

    if (approvalStatus === "pending") {
      await notifyAdminOfSubmission({
        contentType: "atr_comment",
        title: "Edited Ask the Rabbi comment",
        body:
          `By: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
          parsed.data.content,
        linkUrl: "/admin/programs/rabbi?tab=comments",
        status: "pending",
      });
    }

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      parentId: updated.parentId,
      createdAt: updated.createdAt,
      editedAt: updated.editedAt,
      approvalStatus: updated.approvalStatus,
    });
  } catch (error) {
    console.error("[ATR COMMENTS] Error editing comment:", error);
    return NextResponse.json({ error: "Failed to edit comment" }, { status: 500 });
  }
}
