import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { sql, isNull } from "drizzle-orm";

// Cache for 5 minutes - categories rarely change
export const revalidate = 300;

export async function GET() {
  // Get parent categories
  const parents = await db
    .select({
      id: businessCategories.id,
      name: businessCategories.name,
      slug: businessCategories.slug,
      displayOrder: businessCategories.displayOrder,
    })
    .from(businessCategories)
    .where(isNull(businessCategories.parentId))
    .orderBy(businessCategories.displayOrder);

  // Get all subcategories with business counts
  const subcategories = await db
    .select({
      id: businessCategories.id,
      name: businessCategories.name,
      slug: businessCategories.slug,
      parentId: businessCategories.parentId,
      businessCount: sql<number>`(
        SELECT COUNT(*) FROM businesses
        WHERE businesses.category_id = ${businessCategories.id}
        AND businesses.is_active = true
        AND businesses.approval_status = 'approved'
      )`.as("business_count"),
    })
    .from(businessCategories)
    .where(sql`${businessCategories.parentId} IS NOT NULL`)
    .orderBy(businessCategories.name);

  // Combine parent categories with their subcategories
  const categoriesWithSubs = parents
    .map((parent) => {
      const subs = subcategories
        .filter((sub) => sub.parentId === parent.id && sub.name && sub.name.trim() !== "")
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
          businessCount: Number(sub.businessCount || 0),
        }))
        .filter((sub) => sub.businessCount > 0); // Only include subcategories with businesses

      const totalBusinesses = subs.reduce((sum, sub) => sum + sub.businessCount, 0);

      return {
        id: parent.id,
        name: parent.name,
        slug: parent.slug,
        businessCount: totalBusinesses,
        subcategories: subs,
      };
    })
    .filter((cat) => cat.businessCount > 0);

  return NextResponse.json(categoriesWithSubs);
}
