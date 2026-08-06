import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogPosts, blogCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { blogPostSchema } from "@/lib/validations/blog";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";

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

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();
    const result = blogPostSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    // commentModeration is deliberately NOT destructured. It is a post-level
    // OVERRIDE that wins over the site-wide `blog_comment_moderation` setting
    // (blog/[slug]/comments/route.ts:170-175), so accepting it here let any
    // author set their own post to "open" and switch off the moderation an
    // admin had turned on for the whole site. Admins can still set it through
    // the admin route; a member's post inherits the site setting, as null.
    const { title, content, contentJson, coverImageUrl, excerpt, categoryId, customCategory } = result.data;
    const userId = parseInt(session.user.id);

    // The same helper the edit path uses. This was the last create path still
    // computing auto-approve itself, which is exactly the drift a shared helper
    // exists to prevent — the events version of that duplicate logic had
    // already gone wrong twice.
    const approvalStatus = await resolveApprovalStatus(
      "blog",
      userId,
      session.user.role,
      null
    );
    const canAutoApprove = approvalStatus === "approved";
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
        commentModeration: null,
        approvalStatus,
        publishedAt,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "blog_post",
      title: `New blog post submitted: ${title}`,
      body:
        `${title}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/programs/blog",
      status: canAutoApprove ? "auto_approved" : "pending",
    });

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog post:", error);
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 }
    );
  }
}
