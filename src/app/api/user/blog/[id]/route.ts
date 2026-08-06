import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { blogEditSchema } from "@/lib/validations/submission-edits";
import { applyEdit, SubmissionEditError } from "@/lib/submissions/apply-edit";
import { canEditRow } from "@/lib/submissions/ownership";
import { assertCanPost } from "@/lib/auth/require-verified";
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

    // Loading your own post for editing. The gate that matters is on PATCH and
    // DELETE below — an earlier fix put this comment's reasoning here, on the
    // read, and left both writes open.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const { id } = await params;
    const postId = parseInt(id);
    if (Number.isNaN(postId)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }
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

    // The same gate as every other edit route, and as creating a post. A user
    // whose account has been disabled keeps a working JWT — which is the whole
    // case this check exists for — so without it they could still rewrite the
    // HTML of their live published post.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

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
    // The slug follows the title, and is derived rather than submitted — so it
    // is not in the editable whitelist and is written here.
    //
    // BEFORE applyEdit, deliberately: approving inside applyEdit emails the
    // submitter a link built from the row setApprovalStatus reads, and blog's
    // public path is /blog/<slug>. Writing the slug afterwards sends a link to
    // the old one, which 404s.
    // SECURITY: ownership is checked HERE, not only inside applyEdit.
    //
    // The slug write below must precede applyEdit (see above), but applyEdit is
    // where ownership was checked — so PATCHing any post id rewrote that post's
    // slug and only then returned 403. neon-http has no transactions, so the
    // write was already committed, and public reads are by slug, which 404'd
    // the victim's post permanently. applyEdit still checks; this is the guard
    // that has to run before anything is written.
    if (!(await canEditRow("blog", post as Record<string, unknown>, userId, session.user.role))) {
      return NextResponse.json(
        { error: "You can only edit your own posts" },
        { status: 403 }
      );
    }

    const newTitle = result.data.title;
    if (newTitle && newTitle !== post.title) {
      await db
        .update(blogPosts)
        .set({ slug: await getUniqueSlug(newTitle, postId) })
        .where(eq(blogPosts.id, postId));
    }

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

    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

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
