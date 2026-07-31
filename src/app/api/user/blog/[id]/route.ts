import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { blogEditSchema } from "@/lib/validations/submission-edits";
import { applyEdit, SubmissionEditError } from "@/lib/submissions/apply-edit";
import { notifyAdminOfTrustedEdit } from "@/lib/notifications";
import { notifyAdminOfSubmission } from "@/lib/notifications";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string, excludeId: number): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    if (existing.length === 0 || existing[0].id === excludeId) return slug;
    slug = `${generateSlug(baseName)}-${counter++}`;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    const userId = parseInt(session.user.id);

    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    if (post.authorId !== userId) {
      return NextResponse.json(
        { error: "You can only view your own posts" },
        { status: 403 }
      );
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("[API] Error fetching user blog post:", error);
    return NextResponse.json(
      { error: "Failed to fetch blog post" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    const userId = parseInt(session.user.id);

    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = blogEditSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    // Blog now follows the same rule as every other type. Its old rule was the
    // opposite — "only pending or rejected posts can be edited" — which meant
    // an author could never correct a typo in a published post at all. Editing
    // a live post now unpublishes it as `pending_edit` until an admin approves.
    //
    // applyEdit owns ownership, the field whitelist, the shared status
    // resolution and the conditional write; setApprovalStatus owns the
    // transition. The old code wrote approvalStatus itself and set
    // `publishedAt = canAutoApprove ? new Date() : null`, so an ordinary edit
    // NULLED publishedAt — and /api/blog orders by publishedAt DESC, where
    // Postgres puts NULLs first, so a corrected post jumped to the top of the
    // blog. An auto-approver's edit moved it to now, with the same effect.
    let edit;
    try {
      edit = await applyEdit(
        "blog",
        postId,
        userId,
        result.data as Record<string, unknown>,
        session.user.role
      );
    } catch (error) {
      if (error instanceof SubmissionEditError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      throw error;
    }

    // The slug follows the title, and is derived rather than submitted — so it
    // is not in the editable whitelist and is written here.
    const newTitle = result.data.title;
    if (newTitle && newTitle !== post.title) {
      await db
        .update(blogPosts)
        .set({ slug: await getUniqueSlug(newTitle, postId) })
        .where(eq(blogPosts.id, postId));
    }

    // A first publication needs a date. Later ones must NOT move it.
    if (edit.status === "approved" && post.publishedAt === null) {
      await db
        .update(blogPosts)
        .set({ publishedAt: new Date() })
        .where(eq(blogPosts.id, postId));
    }

    const [updatedPost] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, postId))
      .limit(1);

    const stillLive = edit.status === "approved";

    await notifyAdminOfSubmission({
      contentType: "blog_post",
      title: `Blog post edited: ${updatedPost.title}`,
      body:
        `${updatedPost.title}\n` +
        `Edited by: ${session.user.name || session.user.email || "Unknown user"}\n` +
        (edit.wasUnpublished
          ? "This was live and has been taken off the site pending re-approval."
          : stillLive
            ? "This stayed live — the author has auto-approve for blog posts."
            : "This was already awaiting approval."),
      linkUrl: "/admin/programs/blog",
      status: stillLive ? "auto_approved" : "pending",
    });

    if (stillLive) {
      await notifyAdminOfTrustedEdit({
        typeLabel: "Blog post",
        itemTitle: updatedPost.title,
        editorName: session.user.name || session.user.email || "Unknown user",
        linkUrl: "/admin/programs/blog",
      });
    }

    return NextResponse.json({
      ...updatedPost,
      status: edit.status,
      wasUnpublished: edit.wasUnpublished,
      message: edit.wasUnpublished
        ? "Your changes were saved. The post has been taken off the site until an admin approves it."
        : stillLive
          ? "Your changes were saved and the post is still published."
          : "Your changes were saved. The post is still awaiting approval.",
    });
  } catch (error) {
    console.error("[API] Error updating blog post:", error);
    return NextResponse.json(
      { error: "Failed to update blog post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Fetch the post and verify ownership
    const [post] = await db
      .select({ id: blogPosts.id, authorId: blogPosts.authorId })
      .from(blogPosts)
      .where(eq(blogPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    if (post.authorId !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own posts" },
        { status: 403 }
      );
    }

    // Soft delete
    await db
      .update(blogPosts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(blogPosts.id, postId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting blog post:", error);
    return NextResponse.json(
      { error: "Failed to delete blog post" },
      { status: 500 }
    );
  }
}
