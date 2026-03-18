import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, blogComments, users } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const categoryId = searchParams.get("categoryId");
    const offset = (page - 1) * limit;

    const conditions = [
      eq(blogPosts.approvalStatus, "approved"),
      eq(blogPosts.isActive, true),
    ];

    if (categoryId) {
      conditions.push(eq(blogPosts.categoryId, parseInt(categoryId)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);

    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        coverImageUrl: blogPosts.coverImageUrl,
        excerpt: blogPosts.excerpt,
        categoryId: blogPosts.categoryId,
        customCategory: blogPosts.customCategory,
        viewCount: blogPosts.viewCount,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        categoryName: blogCategories.name,
        commentCount: sql<number>`(
          SELECT count(*) FROM blog_comments
          WHERE blog_comments.post_id = ${blogPosts.id}
            AND blog_comments.approval_status = 'approved'
            AND blog_comments.is_active = true
        )`,
      })
      .from(blogPosts)
      .leftJoin(users, eq(blogPosts.authorId, users.id))
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(whereClause)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: posts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching blog posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch blog posts" },
      { status: 500 }
    );
  }
}
