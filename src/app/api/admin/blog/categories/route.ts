import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { blogCategorySchema } from "@/lib/validations/blog";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET - List all blog categories with post counts
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await db
      .select({
        id: blogCategories.id,
        name: blogCategories.name,
        slug: blogCategories.slug,
        displayOrder: blogCategories.displayOrder,
        createdAt: blogCategories.createdAt,
        updatedAt: blogCategories.updatedAt,
        postCount: sql<number>`(SELECT count(*) FROM blog_posts WHERE category_id = ${blogCategories.id})`,
      })
      .from(blogCategories)
      .orderBy(asc(blogCategories.displayOrder));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[API] Error fetching blog categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST - Create new blog category
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = blogCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const slug = generateSlug(result.data.name);

    // Check for duplicate slug
    const existing = await db
      .select({ id: blogCategories.id })
      .from(blogCategories)
      .where(eq(blogCategories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 400 });
    }

    const [category] = await db
      .insert(blogCategories)
      .values({
        name: result.data.name,
        slug,
        displayOrder: result.data.displayOrder ?? 0,
      })
      .returning();

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating blog category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
