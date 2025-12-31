import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifiedCategories, classifieds } from "@/lib/db/schema";
import { sql, eq, and, or, isNull, gt, desc } from "drizzle-orm";

// Cache for 5 minutes - categories rarely change
export const revalidate = 300;

export async function GET() {
  // Get categories with listing counts using LEFT JOIN and GROUP BY
  const categoriesResult = await db
    .select({
      id: classifiedCategories.id,
      name: classifiedCategories.name,
      slug: classifiedCategories.slug,
      displayOrder: classifiedCategories.displayOrder,
      listingCount: sql<number>`count(${classifieds.id})`.as("listing_count"),
    })
    .from(classifiedCategories)
    .leftJoin(
      classifieds,
      and(
        eq(classifieds.categoryId, classifiedCategories.id),
        eq(classifieds.isActive, true),
        eq(classifieds.approvalStatus, "approved"),
        or(
          isNull(classifieds.expiresAt),
          gt(classifieds.expiresAt, new Date())
        )
      )
    )
    .groupBy(
      classifiedCategories.id,
      classifiedCategories.name,
      classifiedCategories.slug,
      classifiedCategories.displayOrder
    )
    .orderBy(classifiedCategories.displayOrder, classifiedCategories.name);

  // Filter to only categories with listings and transform
  const categories = categoriesResult
    .filter((cat) => cat.name && cat.name.trim() !== "")
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      listingCount: Number(cat.listingCount || 0),
    }))
    .filter((cat) => cat.listingCount > 0);

  // Get recent listings (last 10 active, approved listings)
  const recentListingsResult = await db
    .select({
      id: classifieds.id,
      title: classifieds.title,
      price: classifieds.price,
      priceType: classifieds.priceType,
      createdAt: classifieds.createdAt,
      categoryId: classifieds.categoryId,
      categoryName: classifiedCategories.name,
      categorySlug: classifiedCategories.slug,
    })
    .from(classifieds)
    .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
    .where(
      and(
        eq(classifieds.isActive, true),
        eq(classifieds.approvalStatus, "approved"),
        or(
          isNull(classifieds.expiresAt),
          gt(classifieds.expiresAt, new Date())
        )
      )
    )
    .orderBy(desc(classifieds.createdAt))
    .limit(10);

  const recentListings = recentListingsResult.map((listing) => ({
    id: listing.id,
    title: listing.title,
    price: listing.price ? String(listing.price) : null,
    priceType: listing.priceType,
    createdAt: listing.createdAt,
    categoryId: listing.categoryId,
    categoryName: listing.categoryName,
    categorySlug: listing.categorySlug,
  }));

  return NextResponse.json({
    categories,
    recentListings,
  });
}
