import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { blogPostSchema } from "@/lib/validations/blog";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    if (existing.length === 0) return slug;
    slug = `${generateSlug(baseName)}-${counter++}`;
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);

    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        coverImageUrl: blogPosts.coverImageUrl,
        excerpt: blogPosts.excerpt,
        categoryId: blogPosts.categoryId,
        customCategory: blogPosts.customCategory,
        approvalStatus: blogPosts.approvalStatus,
        commentModeration: blogPosts.commentModeration,
        viewCount: blogPosts.viewCount,
        publishedAt: blogPosts.publishedAt,
        isActive: blogPosts.isActive,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        categoryName: blogCategories.name,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(eq(blogPosts.authorId, userId))
      .orderBy(desc(blogPosts.createdAt));

    return NextResponse.json(posts);
  } catch (error) {
    console.error("[API] Error fetching user blog posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch your blog posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
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
    const userId = parseInt(session.user.id);

    // Check canAutoApproveBlog
    const [user] = await db
      .select({ canAutoApproveBlog: users.canAutoApproveBlog })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canAutoApprove = user?.canAutoApproveBlog === true || session.user.role === "admin";
    const approvalStatus = canAutoApprove ? "approved" : "pending";
    const publishedAt = canAutoApprove ? new Date() : null;

    const slug = await getUniqueSlug(title);

    const [newPost] = await db
      .insert(blogPosts)
      .values({
        title,
        slug,
        content,
        contentJson: contentJson || null,
        coverImageUrl: coverImageUrl || null,
        excerpt: excerpt || null,
        authorId: userId,
        categoryId: categoryId || null,
        customCategory: customCategory || null,
        commentModeration: commentModeration || null,
        approvalStatus,
        publishedAt,
      })
      .returning();

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog post:", error);
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 }
    );
  }
}
