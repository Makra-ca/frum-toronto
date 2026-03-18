import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogComments, blogPosts, users } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// GET - List comments with filters and pagination
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "pending";
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(blogComments.approvalStatus, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogComments)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Get comments with author and post info
    const comments = await db
      .select({
        id: blogComments.id,
        postId: blogComments.postId,
        authorId: blogComments.authorId,
        content: blogComments.content,
        parentId: blogComments.parentId,
        approvalStatus: blogComments.approvalStatus,
        isActive: blogComments.isActive,
        createdAt: blogComments.createdAt,
        updatedAt: blogComments.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        postTitle: blogPosts.title,
        postSlug: blogPosts.slug,
      })
      .from(blogComments)
      .leftJoin(users, eq(blogComments.authorId, users.id))
      .leftJoin(blogPosts, eq(blogComments.postId, blogPosts.id))
      .where(whereClause)
      .orderBy(desc(blogComments.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching blog comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
