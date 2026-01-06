import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { sql, isNull, eq, and, asc } from "drizzle-orm";

// Cache for 5 minutes - categories rarely change
export const revalidate = 300;

export async function GET() {
  // Get parent categories (only active ones)
  // Order by displayOrder first, then name as secondary sort
  const parents = await db
    .select({
      id: businessCategories.id,
      name: businessCategories.name,
      slug: businessCategories.slug,
      displayOrder: businessCategories.displayOrder,
    })
    .from(businessCategories)
    .where(and(
      isNull(businessCategories.parentId),
      eq(businessCategories.isActive, true)
    ))
    .orderBy(asc(businessCategories.displayOrder), asc(businessCategories.name));

  // Get all subcategories with business counts using raw SQL for accurate counts
  const subcategoriesRaw = await db.execute(sql`
    SELECT
      bc.id,
      bc.name,
      bc.slug,
      bc.parent_id,
      bc.display_order,
      COALESCE(COUNT(b.id), 0) as business_count
    FROM business_categories bc
    LEFT JOIN businesses b ON b.category_id = bc.id AND b.is_active = true AND b.approval_status = 'approved'
    WHERE bc.parent_id IS NOT NULL
      AND bc.is_active = true
    GROUP BY bc.id, bc.name, bc.slug, bc.parent_id, bc.display_order
    ORDER BY bc.display_order ASC, bc.name ASC
  `);

  const subcategories = subcategoriesRaw.rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    name: String(row.name || ''),
    slug: String(row.slug),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    displayOrder: Number(row.display_order || 0),
    businessCount: Number(row.business_count),
  }));

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
