import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { eq, isNull, asc } from "drizzle-orm";

// GET /api/admin/business-categories - List all categories for form dropdown
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all categories with parent info
    const allCategories = await db
      .select({
        id: businessCategories.id,
        name: businessCategories.name,
        slug: businessCategories.slug,
        parentId: businessCategories.parentId,
        displayOrder: businessCategories.displayOrder,
      })
      .from(businessCategories)
      .where(eq(businessCategories.isActive, true))
      .orderBy(asc(businessCategories.displayOrder), asc(businessCategories.name));

    // Organize into parent/child structure
    const parentCategories = allCategories.filter((c) => c.parentId === null);
    const childCategories = allCategories.filter((c) => c.parentId !== null);

    // Create grouped structure for select dropdown
    const grouped = parentCategories.map((parent) => ({
      ...parent,
      children: childCategories.filter((c) => c.parentId === parent.id),
    }));

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
