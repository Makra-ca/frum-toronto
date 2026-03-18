import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogComments, users, siteSettings } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { blogCommentSchema } from "@/lib/validations/blog";

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

    return NextResponse.json(comments);
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

    const { slug } = await params;

    // Find the post by slug
    const [post] = await db
      .select({
        id: blogPosts.id,
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

    // Determine approval status based on moderation rules
    let approvalStatus = "approved";
    const userRole = session.user.role;

    if (userRole === "admin") {
      approvalStatus = "approved";
    } else if (post.commentModeration === "open") {
      approvalStatus = "approved";
    } else if (post.commentModeration === "approved") {
      approvalStatus = "pending";
    } else {
      // commentModeration is null — check site-wide setting
      const [setting] = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, "blog_comment_moderation"))
        .limit(1);

      if (setting?.value === "approved") {
        approvalStatus = "pending";
      } else {
        approvalStatus = "approved";
      }
    }

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

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
