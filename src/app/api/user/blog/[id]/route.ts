import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { blogPostSchema } from "@/lib/validations/blog";

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

    // Fetch the post and verify ownership
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
        { error: "You can only edit your own posts" },
        { status: 403 }
      );
    }

    // Only allow editing if pending or rejected
    if (post.approvalStatus !== "pending" && post.approvalStatus !== "rejected") {
      return NextResponse.json(
        { error: "Only pending or rejected posts can be edited" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const result = blogPostSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, content, contentJson, coverImageUrl, excerpt, categoryId, customCategory, commentModeration } = result.data;

    // Check canAutoApproveBlog
    const [user] = await db
      .select({ canAutoApproveBlog: users.canAutoApproveBlog })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canAutoApprove = user?.canAutoApproveBlog === true || session.user.role === "admin";
    const approvalStatus = canAutoApprove ? "approved" : "pending";
    const publishedAt = canAutoApprove ? new Date() : null;

    // Regenerate slug if title changed
    let slug = post.slug;
    if (title !== post.title) {
      slug = await getUniqueSlug(title, postId);
    }

    const [updatedPost] = await db
      .update(blogPosts)
      .set({
        title,
        slug,
        content,
        contentJson: contentJson || null,
        coverImageUrl: coverImageUrl || null,
        excerpt: excerpt || null,
        categoryId: categoryId || null,
        customCategory: customCategory || null,
        commentModeration: commentModeration || null,
        approvalStatus,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, postId))
      .returning();

    return NextResponse.json(updatedPost);
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
