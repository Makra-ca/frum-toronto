import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  slug: z.string().min(1).max(150),
  parentId: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isRestaurant: z.boolean().default(false),
});

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
        isRestaurant: businessCategories.isRestaurant,
        isActive: businessCategories.isActive,
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

// POST /api/admin/business-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = categorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check for duplicate slug
    const [existing] = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.slug, data.slug))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 400 }
      );
    }

    const [newCategory] = await db
      .insert(businessCategories)
      .values({
        name: data.name,
        slug: data.slug,
        parentId: data.parentId || null,
        description: data.description || null,
        icon: data.icon || null,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        isRestaurant: data.isRestaurant,
      })
      .returning();

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
