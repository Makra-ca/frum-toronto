import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { eq, sql, asc, desc, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const sort = searchParams.get("sort") || "name-asc";
  const query = searchParams.get("q") || "";
  const city = searchParams.get("city") || null;
  const kosherOnly = searchParams.get("kosher") === "true";

  // Get category
  const categoryResult = await db
    .select({
      id: businessCategories.id,
      name: businessCategories.name,
      slug: businessCategories.slug,
      parentId: businessCategories.parentId,
    })
    .from(businessCategories)
    .where(eq(businessCategories.slug, slug))
    .limit(1);

  if (!categoryResult[0]) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const category = categoryResult[0];

  // Get parent category if exists
  let parentCategory = null;
  if (category.parentId) {
    const parent = await db
      .select({ name: businessCategories.name, slug: businessCategories.slug })
      .from(businessCategories)
      .where(eq(businessCategories.id, category.parentId))
      .limit(1);
    parentCategory = parent[0] || null;
  }

  // Get sibling categories (same parent) with business counts
  const siblingsRaw = await db.execute(sql`
    SELECT
      bc.id,
      bc.name,
      bc.slug,
      COALESCE(COUNT(b.id), 0) as business_count
    FROM business_categories bc
    LEFT JOIN businesses b ON b.category_id = bc.id AND b.is_active = true
    WHERE bc.parent_id = ${category.parentId}
      AND bc.is_active = true
      AND bc.name IS NOT NULL
      AND bc.name != ''
    GROUP BY bc.id, bc.name, bc.slug
    ORDER BY bc.name
  `);

  const siblings = siblingsRaw.rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    businessCount: Number(row.business_count),
  }));

  // Build business query conditions
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Determine sort order
  let orderBy;
  switch (sort) {
    case "name-desc":
      orderBy = desc(businesses.name);
      break;
    case "newest":
      orderBy = desc(businesses.createdAt);
      break;
    default:
      orderBy = asc(businesses.name);
  }

  // Build conditions
  const conditions = [
    eq(businesses.categoryId, category.id),
    eq(businesses.isActive, true),
  ];

  if (query) {
    conditions.push(
      sql`(${businesses.name} ILIKE ${"%" + query + "%"} OR ${businesses.description} ILIKE ${"%" + query + "%"})`
    );
  }

  if (city) {
    conditions.push(eq(businesses.city, city));
  }

  if (kosherOnly) {
    conditions.push(eq(businesses.isKosher, true));
  }

  // Get businesses
  const businessList = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      phone: businesses.phone,
      website: businesses.website,
      isKosher: businesses.isKosher,
      kosherCertification: businesses.kosherCertification,
    })
    .from(businesses)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(businesses)
    .where(and(...conditions));

  const totalCount = Number(countResult[0]?.count) || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Get unique cities for filter
  const citiesResult = await db
    .select({ city: businesses.city })
    .from(businesses)
    .where(
      and(
        eq(businesses.categoryId, category.id),
        eq(businesses.isActive, true),
        sql`${businesses.city} IS NOT NULL AND ${businesses.city} != ''`
      )
    )
    .groupBy(businesses.city)
    .orderBy(businesses.city);

  const cities = citiesResult
    .map((r) => r.city)
    .filter((c): c is string => c !== null);

  return NextResponse.json({
    category,
    parentCategory,
    siblings,
    businesses: businessList,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    cities,
  });
}
