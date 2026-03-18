import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { blogCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { blogCategorySchema } from "@/lib/validations/blog";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// PATCH - Update blog category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();

    const result = blogCategorySchema.partial().safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Fetch existing to check if name changed
    const [existing] = await db
      .select()
      .from(blogCategories)
      .where(eq(blogCategories.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: new Date(),
    };

    // Regenerate slug if name changed
    if (result.data.name && result.data.name !== existing.name) {
      const newSlug = generateSlug(result.data.name);

      // Check for slug conflict (excluding current category)
      const slugConflict = await db
        .select({ id: blogCategories.id })
        .from(blogCategories)
        .where(eq(blogCategories.slug, newSlug))
        .limit(1);

      if (slugConflict.length > 0 && slugConflict[0].id !== categoryId) {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 400 });
      }

      updateData.slug = newSlug;
    }

    const [updated] = await db
      .update(blogCategories)
      .set(updateData)
      .where(eq(blogCategories.id, categoryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating blog category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE - Delete blog category (posts get categoryId set to null via ON DELETE SET NULL)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    const [deleted] = await db
      .delete(blogCategories)
      .where(eq(blogCategories.id, categoryId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting blog category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
