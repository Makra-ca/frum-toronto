import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { categorySchema } from "@/lib/validations/content";
import { eq, sql } from "drizzle-orm";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string, excludeId: number): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.slug, slug))
      .limit(1);

    if (existing.length === 0 || existing[0].id === excludeId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Check if setting parentId would create a circular reference
async function wouldCreateCircle(categoryId: number, newParentId: number): Promise<boolean> {
  if (categoryId === newParentId) return true;

  // Get all descendants of the category
  const getDescendants = async (id: number): Promise<number[]> => {
    const children = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.parentId, id));

    const descendantIds: number[] = children.map((c) => c.id);
    for (const child of children) {
      const childDescendants = await getDescendants(child.id);
      descendantIds.push(...childDescendants);
    }
    return descendantIds;
  };

  const descendants = await getDescendants(categoryId);
  return descendants.includes(newParentId);
}

// GET /api/admin/categories/[id] - Get single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [category] = await db
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
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if category exists
    const [existingCategory] = await db
      .select()
      .from(businessCategories)
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Check for circular reference if parentId is being changed
    if (validatedData.parentId && validatedData.parentId !== existingCategory.parentId) {
      const isCircular = await wouldCreateCircle(categoryId, validatedData.parentId);
      if (isCircular) {
        return NextResponse.json(
          { error: "Cannot set parent to self or a descendant" },
          { status: 400 }
        );
      }

      // Verify parent exists
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

    // Generate new slug if name changed
    let slug = existingCategory.slug;
    if (validatedData.name !== existingCategory.name) {
      slug = await getUniqueSlug(validatedData.name, categoryId);
    }

    const [updatedCategory] = await db
      .update(businessCategories)
      .set({
        name: validatedData.name,
        slug,
        description: validatedData.description,
        icon: validatedData.icon,
        imageUrl: validatedData.imageUrl || null,
        parentId: validatedData.parentId,
        displayOrder: validatedData.displayOrder,
        isActive: validatedData.isActive,
      })
      .where(eq(businessCategories.id, categoryId))
      .returning();

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/categories/[id] - Delete category (only if no businesses)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if category exists
    const [existingCategory] = await db
      .select()
      .from(businessCategories)
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check if there are any businesses in this category
    const [businessCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(eq(businesses.categoryId, categoryId));

    if (Number(businessCount?.count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category with businesses",
          businessCount: Number(businessCount.count),
        },
        { status: 400 }
      );
    }

    // Check if there are child categories
    const [childCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessCategories)
      .where(eq(businessCategories.parentId, categoryId));

    if (Number(childCount?.count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category with subcategories",
          childCount: Number(childCount.count),
        },
        { status: 400 }
      );
    }

    await db.delete(businessCategories).where(eq(businessCategories.id, categoryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
