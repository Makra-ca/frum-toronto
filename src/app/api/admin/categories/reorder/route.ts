import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { eq, asc, and, lt, gt, isNull } from "drizzle-orm";

// POST /api/admin/categories/reorder - Swap displayOrder with adjacent category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { categoryId, direction } = body;

    if (!categoryId || !["up", "down"].includes(direction)) {
      return NextResponse.json(
        { error: "Invalid request. Requires categoryId and direction (up/down)" },
        { status: 400 }
      );
    }

    // Get the category to move
    const [category] = await db
      .select()
      .from(businessCategories)
      .where(eq(businessCategories.id, categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const currentOrder = category.displayOrder ?? 0;

    // Find adjacent category at the same parent level
    let adjacentCategory;

    if (direction === "up") {
      // Find the category with the highest displayOrder that is less than current
      const parentCondition = category.parentId
        ? eq(businessCategories.parentId, category.parentId)
        : isNull(businessCategories.parentId);

      const results = await db
        .select()
        .from(businessCategories)
        .where(
          and(
            parentCondition,
            lt(businessCategories.displayOrder, currentOrder)
          )
        )
        .orderBy(asc(businessCategories.displayOrder));

      // Get the one closest to current (last in ascending order with displayOrder < current)
      // But since we want the one immediately before, we need to find the max
      const higherOrderCategories = results.filter(c => (c.displayOrder ?? 0) < currentOrder);
      adjacentCategory = higherOrderCategories.length > 0
        ? higherOrderCategories[higherOrderCategories.length - 1]
        : null;
    } else {
      // Find the category with the lowest displayOrder that is greater than current
      const parentCondition = category.parentId
        ? eq(businessCategories.parentId, category.parentId)
        : isNull(businessCategories.parentId);

      const results = await db
        .select()
        .from(businessCategories)
        .where(
          and(
            parentCondition,
            gt(businessCategories.displayOrder, currentOrder)
          )
        )
        .orderBy(asc(businessCategories.displayOrder));

      adjacentCategory = results.length > 0 ? results[0] : null;
    }

    if (!adjacentCategory) {
      return NextResponse.json(
        { error: `Cannot move ${direction}: already at ${direction === "up" ? "top" : "bottom"}` },
        { status: 400 }
      );
    }

    // Swap displayOrder values
    const adjacentOrder = adjacentCategory.displayOrder ?? 0;

    await db
      .update(businessCategories)
      .set({ displayOrder: adjacentOrder })
      .where(eq(businessCategories.id, categoryId));

    await db
      .update(businessCategories)
      .set({ displayOrder: currentOrder })
      .where(eq(businessCategories.id, adjacentCategory.id));

    return NextResponse.json({
      success: true,
      swapped: {
        category1: { id: categoryId, newOrder: adjacentOrder },
        category2: { id: adjacentCategory.id, newOrder: currentOrder }
      }
    });
  } catch (error) {
    console.error("Error reordering category:", error);
    return NextResponse.json(
      { error: "Failed to reorder category" },
      { status: 500 }
    );
  }
}
