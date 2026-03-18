import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, blogComments, users } from "@/lib/db/schema";
import { eq, and, or, desc, sql, ilike } from "drizzle-orm";
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

// GET - List all blog posts with pagination and filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const categoryId = searchParams.get("categoryId");
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(ilike(blogPosts.title, searchTerm));
    }

    if (status !== "all") {
      conditions.push(eq(blogPosts.approvalStatus, status));
    }

    if (categoryId) {
      conditions.push(eq(blogPosts.categoryId, parseInt(categoryId)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Get posts with author and category info
    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
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
        commentCount: sql<number>`(SELECT count(*) FROM blog_comments WHERE post_id = ${blogPosts.id})`,
      })
      .from(blogPosts)
      .leftJoin(users, eq(blogPosts.authorId, users.id))
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(whereClause)
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching blog posts:", error);
    return NextResponse.json({ error: "Failed to fetch blog posts" }, { status: 500 });
  }
}

// POST - Create new blog post
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = blogPostSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const slug = await getUniqueSlug(result.data.title);

    const [post] = await db
      .insert(blogPosts)
      .values({
        title: result.data.title,
        slug,
        content: result.data.content,
        contentJson: result.data.contentJson || null,
        coverImageUrl: result.data.coverImageUrl || null,
        excerpt: result.data.excerpt || null,
        authorId: parseInt(session.user.id),
        categoryId: result.data.categoryId || null,
        customCategory: result.data.customCategory || null,
        commentModeration: result.data.commentModeration || null,
        approvalStatus: "approved",
        publishedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog post:", error);
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 });
  }
}
