import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogComments, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { blogCommentSchema, blogCommentEditSchema } from "@/lib/validations/blog";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import { applyTombstones } from "@/lib/comments/tombstone";
import { resolveCommentOutcome } from "@/lib/comments/resolve";
import {
  refuseCommentEdit,
  EDIT_REFUSAL_MESSAGES,
  EDIT_REFUSAL_STATUS,
} from "@/lib/comments/edit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the post by slug
    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, slug),
          eq(blogPosts.approvalStatus, "approved"),
          eq(blogPosts.isActive, true)
        )
      )
      .limit(1);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    const comments = await db
      .select({
        id: blogComments.id,
        postId: blogComments.postId,
        authorId: blogComments.authorId,
        content: blogComments.content,
        parentId: blogComments.parentId,
        createdAt: blogComments.createdAt,
        deletedAt: blogComments.deletedAt,
        editedAt: blogComments.editedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(blogComments)
      .leftJoin(users, eq(blogComments.authorId, users.id))
      .where(
        and(
          eq(blogComments.postId, post.id),
          eq(blogComments.approvalStatus, "approved"),
          eq(blogComments.isActive, true)
        )
      )
      .orderBy(asc(blogComments.createdAt));

    // Deleted rows are fetched, not filtered in SQL, because a deleted parent
    // must survive as a tombstone when its replies are still live. The text
    // and author are blanked server-side — hiding them in the client would
    // still ship them in this response.
    const mapped = applyTombstones(comments).map((c) => ({
      id: c.id,
      authorId: c.authorId,
      content: c.content,
      parentId: c.parentId,
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
    console.error("[API] Error fetching blog comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const { slug } = await params;

    // Find the post by slug
    const [post] = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        commentModeration: blogPosts.commentModeration,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, slug),
          eq(blogPosts.approvalStatus, "approved"),
          eq(blogPosts.isActive, true)
        )
      )
      .limit(1);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const result = blogCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, parentId } = result.data;

    // The same resolution the EDIT path uses. This route never read
    // `commentPermission` at all before, so an account set to "Blocked" in
    // Admin → Users could comment here freely. Resolved before the parent
    // lookup so a blocked request does no further work.
    const outcome = await resolveCommentOutcome({
      userId: parseInt(session.user.id),
      isAdmin: session.user.role === "admin",
      surface: "blog",
      itemModeration: post.commentModeration,
    });

    if (outcome === "blocked") {
      // Same wording and status as Ask the Rabbi, so a blocked person sees one
      // consistent message wherever they try to comment.
      return NextResponse.json(
        { error: "You are not permitted to comment." },
        { status: 403 }
      );
    }

    // Enforce max nesting depth of 1: no replies to replies
    if (parentId) {
      const [parentComment] = await db
        .select({ id: blogComments.id, parentId: blogComments.parentId })
        .from(blogComments)
        .where(
          and(
            eq(blogComments.id, parentId),
            eq(blogComments.postId, post.id),
            eq(blogComments.isActive, true)
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
      .insert(blogComments)
      .values({
        postId: post.id,
        authorId: parseInt(session.user.id),
        content,
        parentId: parentId || null,
        approvalStatus,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "blog_comment",
      title: `New blog comment on "${post.title}"`,
      body:
        `Post: ${post.title}\n` +
        `By: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
        content,
      linkUrl: "/admin/programs/blog/comments",
      status: approvalStatus === "pending" ? "pending" : "auto_approved",
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/blog/[slug]/comments?commentId=xxx
// Users can delete their own comments; admins can delete any (with cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("commentId") || "");

    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Find the post to confirm it exists
    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.isActive, true)))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    const [comment] = await db
      .select({
        id: blogComments.id,
        authorId: blogComments.authorId,
        parentId: blogComments.parentId,
        // Needed for the audit entry: after this the text is shown nowhere.
        content: blogComments.content,
      })
      .from(blogComments)
      .where(and(eq(blogComments.id, commentId), eq(blogComments.postId, post.id)))
      .limit(1);

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (!isAdmin && comment.authorId !== userId) {
      return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
    }

    // Soft delete. The old code hard-deleted the comment AND every reply to
    // it, so removing one's own question destroyed other people's answers.
    // Now the row stays: applyTombstones drops it if nothing replied, and
    // keeps it as "[deleted]" if a reply is still live.
    await db
      .update(blogComments)
      .set({ deletedAt: new Date() })
      .where(eq(blogComments.id, commentId));


    // Audited only when someone removes a comment that is not theirs. A person
    // deleting their own is ordinary use; a moderator removing another
    // person's is an action that should be answerable for.
    if (comment.authorId !== userId) {
      await logAudit({
        actorId: userId,
        actorEmail: session.user.email ?? "unknown",
        action: "DELETE",
        entityType: "blog_comment",
        entityId: commentId,
        entityTitle: comment.content?.slice(0, 120) ?? null,
        ipAddress: getIpFromRequest(request),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting blog comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

// PATCH /api/blog/[slug]/comments?commentId=xxx
//
// The author corrects their own comment. There was no edit route at all until
// now, so a typo could only be fixed by deleting and reposting — which on a
// reply loses its place in the thread.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("commentId") || "");
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = blogCommentEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const [post] = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        commentModeration: blogPosts.commentModeration,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, slug),
          eq(blogPosts.approvalStatus, "approved"),
          eq(blogPosts.isActive, true)
        )
      )
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    const [comment] = await db
      .select({
        id: blogComments.id,
        authorId: blogComments.authorId,
        content: blogComments.content,
        deletedAt: blogComments.deletedAt,
        approvalStatus: blogComments.approvalStatus,
      })
      .from(blogComments)
      .where(
        and(eq(blogComments.id, commentId), eq(blogComments.postId, post.id))
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

    // Re-moderated exactly like a new comment. Without this, a site set to
    // "hold for approval" is defeated by posting something innocuous, waiting
    // for approval, then editing it into whatever you wanted to say.
    const outcome = await resolveCommentOutcome({
      userId,
      isAdmin: session.user.role === "admin",
      surface: "blog",
      itemModeration: post.commentModeration,
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
      .update(blogComments)
      .set({
        content: parsed.data.content,
        // editedAt, not updatedAt: updatedAt also moves on approve/reject, so
        // it cannot honestly be shown to a reader as "the author changed this".
        editedAt: new Date(),
        approvalStatus,
      })
      .where(eq(blogComments.id, commentId))
      .returning();

    // Logged only when the old text had already been public. That is the
    // bait-and-switch case: people read one thing and the record now says
    // another, and the audit entry is the only place the original survives.
    if (wasPublic) {
      await logAudit({
        actorId: userId,
        actorEmail: session.user.email ?? "unknown",
        action: "UPDATE",
        entityType: "blog_comment",
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
        contentType: "blog_comment",
        title: `Edited blog comment on "${post.title}"`,
        body:
          `Post: ${post.title}\n` +
          `By: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
          parsed.data.content,
        linkUrl: "/admin/programs/blog/comments",
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
    console.error("[API] Error editing blog comment:", error);
    return NextResponse.json(
      { error: "Failed to edit comment" },
      { status: 500 }
    );
  }
}
