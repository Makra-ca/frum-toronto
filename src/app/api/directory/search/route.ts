import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { eq, sql, asc, desc, and, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const sort = searchParams.get("sort") || "relevance";
  const city = searchParams.get("city") || null;
  const kosherOnly = searchParams.get("kosher") === "true";
  const kosherType = searchParams.get("kosherType") || null;
  const categorySlug = searchParams.get("category") || null;

  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Build conditions
  const conditions = [
    eq(businesses.isActive, true),
    eq(businesses.approvalStatus, "approved"),
  ];

  // Search query - search in name, description, and category name
  if (query) {
    conditions.push(
      sql`(
        ${businesses.name} ILIKE ${"%" + query + "%"}
        OR ${businesses.description} ILIKE ${"%" + query + "%"}
        OR EXISTS (
          SELECT 1 FROM business_categories bc
          WHERE bc.id = ${businesses.categoryId}
          AND bc.name ILIKE ${"%" + query + "%"}
        )
      )`
    );
  }

  // City filter
  if (city) {
    conditions.push(eq(businesses.city, city));
  }

  // Kosher filter
  if (kosherOnly) {
    conditions.push(eq(businesses.isKosher, true));
  }

  // Specific kosher certification type
  if (kosherType) {
    conditions.push(eq(businesses.kosherCertification, kosherType));
  }

  // Category filter
  if (categorySlug) {
    const categoryResult = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.slug, categorySlug))
      .limit(1);

    if (categoryResult[0]) {
      conditions.push(eq(businesses.categoryId, categoryResult[0].id));
    }
  }

  // Determine sort order
  let orderBy: ReturnType<typeof asc> | ReturnType<typeof sql>;
  switch (sort) {
    case "name-asc":
      orderBy = asc(sql`LOWER(TRIM(${businesses.name}))`);
      break;
    case "name-desc":
      orderBy = desc(sql`LOWER(TRIM(${businesses.name}))`);
      break;
    case "newest":
      orderBy = desc(businesses.createdAt);
      break;
    case "popular":
      orderBy = desc(businesses.viewCount);
      break;
    default:
      // Relevance: featured first, then by admin-defined order, then by view count
      orderBy = sql`
        CASE WHEN ${businesses.isFeatured} = true THEN 0 ELSE 1 END,
        ${businesses.displayOrder} ASC NULLS LAST,
        ${businesses.viewCount} DESC NULLS LAST,
        ${businesses.name} ASC
      `;
  }

  // Get businesses with category info
  const businessList = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      phone: businesses.phone,
      email: businesses.email,
      website: businesses.website,
      logoUrl: businesses.logoUrl,
      hours: businesses.hours,
      isKosher: businesses.isKosher,
      kosherCertification: businesses.kosherCertification,
      isFeatured: businesses.isFeatured,
      categoryId: businesses.categoryId,
      categoryName: businessCategories.name,
      categorySlug: businessCategories.slug,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
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

  // Get unique cities for filter options
  const citiesResult = await db
    .select({ city: businesses.city })
    .from(businesses)
    .where(
      and(
        eq(businesses.isActive, true),
        eq(businesses.approvalStatus, "approved"),
        sql`${businesses.city} IS NOT NULL AND ${businesses.city} != ''`
      )
    )
    .groupBy(businesses.city)
    .orderBy(businesses.city);

  const cities = citiesResult
    .map((r) => r.city)
    .filter((c): c is string => c !== null);

  // Get unique kosher certifications for filter options
  const kosherCertsResult = await db
    .select({ cert: businesses.kosherCertification })
    .from(businesses)
    .where(
      and(
        eq(businesses.isActive, true),
        eq(businesses.approvalStatus, "approved"),
        eq(businesses.isKosher, true),
        sql`${businesses.kosherCertification} IS NOT NULL AND ${businesses.kosherCertification} != ''`
      )
    )
    .groupBy(businesses.kosherCertification)
    .orderBy(businesses.kosherCertification);

  const kosherCertifications = kosherCertsResult
    .map((r) => r.cert)
    .filter((c): c is string => c !== null);

  // Get categories for filter options
  const categoriesResult = await db
    .select({
      id: businessCategories.id,
      name: businessCategories.name,
      slug: businessCategories.slug,
    })
    .from(businessCategories)
    .where(
      and(
        eq(businessCategories.isActive, true),
        sql`${businessCategories.parentId} IS NOT NULL`
      )
    )
    .orderBy(businessCategories.name);

  return NextResponse.json({
    businesses: businessList,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    filters: {
      applied: {
        query,
        city,
        kosherOnly,
        kosherType,
        categorySlug,
        sort,
      },
      available: {
        cities,
        kosherCertifications,
        categories: categoriesResult,
      },
    },
  });
}
