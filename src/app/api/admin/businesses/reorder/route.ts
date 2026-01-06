import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq, asc, and, lt, gt } from "drizzle-orm";

// POST /api/admin/businesses/reorder - Swap displayOrder with adjacent business in same category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, direction } = body;

    if (!businessId || !["up", "down"].includes(direction)) {
      return NextResponse.json(
        { error: "Invalid request. Requires businessId and direction (up/down)" },
        { status: 400 }
      );
    }

    // Get the business to move
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const currentOrder = business.displayOrder ?? 0;
    const categoryId = business.categoryId;

    if (!categoryId) {
      return NextResponse.json(
        { error: "Business has no category assigned" },
        { status: 400 }
      );
    }

    // Find adjacent business in the same category
    let adjacentBusiness;

    if (direction === "up") {
      // Find the business with the highest displayOrder that is less than current
      const results = await db
        .select()
        .from(businesses)
        .where(
          and(
            eq(businesses.categoryId, categoryId),
            lt(businesses.displayOrder, currentOrder)
          )
        )
        .orderBy(asc(businesses.displayOrder));

      // Get the one closest to current (highest displayOrder below current)
      const lowerOrderBusinesses = results.filter(b => (b.displayOrder ?? 0) < currentOrder);
      adjacentBusiness = lowerOrderBusinesses.length > 0
        ? lowerOrderBusinesses[lowerOrderBusinesses.length - 1]
        : null;
    } else {
      // Find the business with the lowest displayOrder that is greater than current
      const results = await db
        .select()
        .from(businesses)
        .where(
          and(
            eq(businesses.categoryId, categoryId),
            gt(businesses.displayOrder, currentOrder)
          )
        )
        .orderBy(asc(businesses.displayOrder));

      adjacentBusiness = results.length > 0 ? results[0] : null;
    }

    if (!adjacentBusiness) {
      return NextResponse.json(
        { error: `Cannot move ${direction}: already at ${direction === "up" ? "top" : "bottom"}` },
        { status: 400 }
      );
    }

    // Swap displayOrder values
    const adjacentOrder = adjacentBusiness.displayOrder ?? 0;

    await db
      .update(businesses)
      .set({ displayOrder: adjacentOrder })
      .where(eq(businesses.id, businessId));

    await db
      .update(businesses)
      .set({ displayOrder: currentOrder })
      .where(eq(businesses.id, adjacentBusiness.id));

    return NextResponse.json({
      success: true,
      swapped: {
        business1: { id: businessId, newOrder: adjacentOrder },
        business2: { id: adjacentBusiness.id, newOrder: currentOrder }
      }
    });
  } catch (error) {
    console.error("Error reordering business:", error);
    return NextResponse.json(
      { error: "Failed to reorder business" },
      { status: 500 }
    );
  }
}
