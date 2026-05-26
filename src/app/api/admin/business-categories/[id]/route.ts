import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isRestaurant: z.boolean().optional(),
  parentId: z.number().nullable().optional(),
});

// GET /api/admin/business-categories/[id] - Get single category
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
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    const [category] = await db
      .select()
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

// PATCH /api/admin/business-categories/[id] - Update category
export async function PATCH(
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
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const data = result.data;
    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.icon !== undefined) updateFields.icon = data.icon;
    if (data.displayOrder !== undefined) updateFields.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;
    if (data.isRestaurant !== undefined) updateFields.isRestaurant = data.isRestaurant;
    if (data.parentId !== undefined) updateFields.parentId = data.parentId;

    const [updated] = await db
      .update(businessCategories)
      .set(updateFields)
      .where(eq(businessCategories.id, categoryId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/business-categories/[id] - Delete category
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
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
