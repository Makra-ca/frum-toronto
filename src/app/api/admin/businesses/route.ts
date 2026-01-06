import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, businessCategories, users } from "@/lib/db/schema";
import { businessSchema } from "@/lib/validations/content";
import { eq, desc, asc, and, like, or, ilike, sql } from "drizzle-orm";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-"); // Multiple hyphens to single
}

async function getUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// GET /api/admin/businesses - List all businesses with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, approved, rejected, all
    const search = searchParams.get("search");
    const categoryId = searchParams.get("categoryId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [];

    if (status && status !== "all") {
      conditions.push(eq(businesses.approvalStatus, status));
    }

    if (categoryId && categoryId !== "all") {
      conditions.push(eq(businesses.categoryId, parseInt(categoryId)));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(businesses.name, searchTerm),
          ilike(businesses.email, searchTerm),
          ilike(businesses.phone, searchTerm),
          ilike(businesses.address, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated businesses
    const paginatedBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        description: businesses.description,
        address: businesses.address,
        city: businesses.city,
        postalCode: businesses.postalCode,
        phone: businesses.phone,
        email: businesses.email,
        website: businesses.website,
        logoUrl: businesses.logoUrl,
        hours: businesses.hours,
        isKosher: businesses.isKosher,
        kosherCertification: businesses.kosherCertification,
        approvalStatus: businesses.approvalStatus,
        isFeatured: businesses.isFeatured,
        displayOrder: businesses.displayOrder,
        isActive: businesses.isActive,
        createdAt: businesses.createdAt,
        categoryId: businesses.categoryId,
        categoryName: businessCategories.name,
        parentCategoryId: businessCategories.parentId,
        ownerEmail: users.email,
        ownerName: users.firstName,
      })
      .from(businesses)
      .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
      .leftJoin(users, eq(businesses.userId, users.id))
      .where(whereClause)
      .orderBy(asc(businesses.displayOrder), asc(businesses.name))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      businesses: paginatedBusinesses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    return NextResponse.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}

// POST /api/admin/businesses - Create a new business
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = businessSchema.parse(body);

    // Generate unique slug from name
    const slug = await getUniqueSlug(validatedData.name);

    const [newBusiness] = await db
      .insert(businesses)
      .values({
        name: validatedData.name,
        slug,
        categoryId: validatedData.categoryId,
        description: validatedData.description,
        address: validatedData.address,
        city: validatedData.city || "Toronto",
        postalCode: validatedData.postalCode,
        phone: validatedData.phone,
        email: validatedData.email || null,
        website: validatedData.website,
        isKosher: validatedData.isKosher,
        kosherCertification: validatedData.kosherCertification,
        hours: validatedData.hours,
        isFeatured: validatedData.isFeatured,
        approvalStatus: "approved", // Admin-created businesses are auto-approved
        isActive: true,
      })
      .returning();

    return NextResponse.json(newBusiness, { status: 201 });
  } catch (error) {
    console.error("Error creating business:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
