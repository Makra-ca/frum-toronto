import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { eq, sql, isNull, count } from "drizzle-orm";
import { Building2 } from "lucide-react";
import { AmazonStyleBrowser } from "@/components/directory/AmazonStyleBrowser";

export const metadata = {
  title: "Business Directory",
  description: "Browse the Toronto Jewish Orthodox community business directory",
};

async function getCategoriesWithSubcategories() {
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

  // Get total business count
  const totalResult = await db
    .select({ count: count() })
    .from(businesses)
    .where(eq(businesses.isActive, true));

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

  // Get top 6 subcategories by business count
  const topCategories = subcategories
    .filter((sub) => sub.name && sub.name.trim() !== "" && Number(sub.businessCount || 0) > 0)
    .map((sub) => ({
      name: sub.name,
      slug: sub.slug,
      count: Number(sub.businessCount || 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    categories: categoriesWithSubs,
    totalBusinesses: totalResult[0]?.count || 0,
    topCategories,
  };
}

export default async function DirectoryPage() {
  const { categories, totalBusinesses, topCategories } = await getCategoriesWithSubcategories();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Business Directory
            </h1>
          </div>
          <p className="text-blue-200 text-lg">
            Browse {totalBusinesses.toLocaleString()} local businesses serving the Toronto Jewish community
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <AmazonStyleBrowser categories={categories} topCategories={topCategories} />
      </div>
    </div>
  );
}
