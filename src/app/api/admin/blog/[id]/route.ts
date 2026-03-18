import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, users } from "@/lib/db/schema";
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

// GET - Get single blog post by id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = parseInt(id);

    const [post] = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        content: blogPosts.content,
        contentJson: blogPosts.contentJson,
        coverImageUrl: blogPosts.coverImageUrl,
        excerpt: blogPosts.excerpt,
        authorId: blogPosts.authorId,
        categoryId: blogPosts.categoryId,
        customCategory: blogPosts.customCategory,
        approvalStatus: blogPosts.approvalStatus,
        commentModeration: blogPosts.commentModeration,
        viewCount: blogPosts.viewCount,
        publishedAt: blogPosts.publishedAt,
        isActive: blogPosts.isActive,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        categoryName: blogCategories.name,
      })
      .from(blogPosts)
      .leftJoin(users, eq(blogPosts.authorId, users.id))
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(eq(blogPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("[API] Error fetching blog post:", error);
    return NextResponse.json({ error: "Failed to fetch blog post" }, { status: 500 });
  }
}

// PATCH - Update blog post
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
    const postId = parseInt(id);
    const body = await request.json();

    const result = blogPostSchema.partial().safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Fetch existing post to check current state
    const [existing] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, postId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: new Date(),
    };

    // If approving and not yet published, set publishedAt
    if (
      body.approvalStatus === "approved" &&
      existing.publishedAt === null
    ) {
      updateData.approvalStatus = "approved";
      updateData.publishedAt = new Date();
    }

    // If title changed, regenerate slug
    if (result.data.title && result.data.title !== existing.title) {
      updateData.slug = await getUniqueSlug(result.data.title, postId);
    }

    // Normalize empty strings to null
    if (updateData.coverImageUrl === "") updateData.coverImageUrl = null;
    if (updateData.excerpt === "") updateData.excerpt = null;
    if (updateData.customCategory === "") updateData.customCategory = null;

    const [updated] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, postId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating blog post:", error);
    return NextResponse.json({ error: "Failed to update blog post" }, { status: 500 });
  }
}

// DELETE - Soft delete blog post (set isActive to false)
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
    const postId = parseInt(id);

    const [updated] = await db
      .update(blogPosts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(blogPosts.id, postId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting blog post:", error);
    return NextResponse.json({ error: "Failed to delete blog post" }, { status: 500 });
  }
}
