import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { categorySchema } from "@/lib/validations/content";
import { eq, desc, sql, asc, isNull } from "drizzle-orm";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string, excludeId?: number): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const conditions = [eq(businessCategories.slug, slug)];

    const existing = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.slug, slug))
      .limit(1);

    if (existing.length === 0 || (excludeId && existing[0].id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// GET /api/admin/categories - List all categories with business counts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // all, active, inactive
    const search = searchParams.get("search");

    // Get all categories with business counts
    const allCategories = await db
      .select({
        id: businessCategories.id,
        name: businessCategories.name,
        slug: businessCategories.slug,
        parentId: businessCategories.parentId,
        description: businessCategories.description,
        icon: businessCategories.icon,
        imageUrl: businessCategories.imageUrl,
        displayOrder: businessCategories.displayOrder,
        isActive: businessCategories.isActive,
        businessCount: sql<number>`(
          SELECT COUNT(*) FROM businesses
          WHERE businesses.category_id = ${businessCategories.id}
        )`.as("business_count"),
      })
      .from(businessCategories)
      .orderBy(asc(businessCategories.displayOrder), asc(businessCategories.name));

    // Apply filters
    let filteredCategories = allCategories;

    if (status === "active") {
      filteredCategories = filteredCategories.filter((c) => c.isActive);
    } else if (status === "inactive") {
      filteredCategories = filteredCategories.filter((c) => !c.isActive);
    }

    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredCategories = filteredCategories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.slug.toLowerCase().includes(searchLower)
      );
    }

    // Organize into hierarchy
    const parentCategories = filteredCategories.filter((c) => c.parentId === null);
    const childCategories = filteredCategories.filter((c) => c.parentId !== null);

    const hierarchical = parentCategories.map((parent) => ({
      ...parent,
      children: childCategories.filter((c) => c.parentId === parent.id),
    }));

    // Also include orphaned children (children whose parent was filtered out)
    const parentIds = parentCategories.map((p) => p.id);
    const orphanedChildren = childCategories.filter(
      (c) => c.parentId && !parentIds.includes(c.parentId)
    );

    return NextResponse.json({
      categories: hierarchical,
      orphanedChildren,
      totalCount: filteredCategories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/admin/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Generate unique slug from name
    const slug = await getUniqueSlug(validatedData.name);

    // Validate parentId if provided
    if (validatedData.parentId) {
      const [parent] = await db
        .select({ id: businessCategories.id })
        .from(businessCategories)
        .where(eq(businessCategories.id, validatedData.parentId))
        .limit(1);

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 400 }
        );
      }
    }

    const [newCategory] = await db
      .insert(businessCategories)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description,
        icon: validatedData.icon,
        imageUrl: validatedData.imageUrl || null,
        parentId: validatedData.parentId,
        displayOrder: validatedData.displayOrder,
        isActive: validatedData.isActive,
      })
      .returning();

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
