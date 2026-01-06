import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const mergeSchema = z.object({
  targetCategoryId: z.number().int().positive("Target category is required"),
});

// POST /api/admin/categories/[id]/merge - Merge source category into target
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sourceCategoryId = parseInt(id);

    if (isNaN(sourceCategoryId)) {
      return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
    }

    const body = await request.json();
    const { targetCategoryId } = mergeSchema.parse(body);

    // Can't merge into self
    if (sourceCategoryId === targetCategoryId) {
      return NextResponse.json(
        { error: "Cannot merge a category into itself" },
        { status: 400 }
      );
    }

    // Check source exists
    const [sourceCategory] = await db
      .select()
      .from(businessCategories)
      .where(eq(businessCategories.id, sourceCategoryId))
      .limit(1);

    if (!sourceCategory) {
      return NextResponse.json(
        { error: "Source category not found" },
        { status: 404 }
      );
    }

    // Check target exists
    const [targetCategory] = await db
      .select()
      .from(businessCategories)
      .where(eq(businessCategories.id, targetCategoryId))
      .limit(1);

    if (!targetCategory) {
      return NextResponse.json(
        { error: "Target category not found" },
        { status: 404 }
      );
    }

    // Count businesses to be moved
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(eq(businesses.categoryId, sourceCategoryId));

    const businessCount = Number(countResult?.count || 0);

    // Move all businesses from source to target
    if (businessCount > 0) {
      await db
        .update(businesses)
        .set({ categoryId: targetCategoryId })
        .where(eq(businesses.categoryId, sourceCategoryId));
    }

    // Move any child categories to the target's parent (or make them top-level if target has no parent)
    // This handles the case where the source had subcategories
    const childCategories = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.parentId, sourceCategoryId));

    if (childCategories.length > 0) {
      await db
        .update(businessCategories)
        .set({ parentId: targetCategory.parentId })
        .where(eq(businessCategories.parentId, sourceCategoryId));
    }

    // Archive the source category (set inactive)
    await db
      .update(businessCategories)
      .set({ isActive: false })
      .where(eq(businessCategories.id, sourceCategoryId));

    return NextResponse.json({
      success: true,
      message: `Merged ${businessCount} businesses from "${sourceCategory.name}" into "${targetCategory.name}"`,
      businessesMoved: businessCount,
      childCategoriesMoved: childCategories.length,
      sourceCategory: {
        id: sourceCategory.id,
        name: sourceCategory.name,
        isActive: false,
      },
      targetCategory: {
        id: targetCategory.id,
        name: targetCategory.name,
      },
    });
  } catch (error) {
    console.error("Error merging categories:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to merge categories" },
      { status: 500 }
    );
  }
}
