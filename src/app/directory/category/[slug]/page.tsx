import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { businessCategories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { SubcategoryBrowser } from "@/components/directory/SubcategoryBrowser";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const category = await db
    .select({ name: businessCategories.name })
    .from(businessCategories)
    .where(eq(businessCategories.slug, slug))
    .limit(1);

  if (!category[0]) {
    return { title: "Category Not Found" };
  }

  return {
    title: `${category[0].name} - Business Directory`,
    description: `Browse ${category[0].name} businesses in the Toronto Jewish community`,
  };
}

async function getCategoryData(slug: string) {
  // Get the parent category
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
    return null;
  }

  const category = categoryResult[0];

  // If this is a parent category, get its subcategories with business counts
  if (category.parentId === null) {
    // Use raw SQL with JOIN for accurate business counts
    const subcategoriesRaw = await db.execute(sql`
      SELECT
        bc.id,
        bc.name,
        bc.slug,
        COALESCE(COUNT(b.id), 0) as business_count
      FROM business_categories bc
      LEFT JOIN businesses b ON b.category_id = bc.id AND b.is_active = true AND b.approval_status = 'approved'
      WHERE bc.parent_id = ${category.id}
        AND bc.is_active = true
        AND bc.name IS NOT NULL
        AND bc.name != ''
      GROUP BY bc.id, bc.name, bc.slug
      ORDER BY bc.name
    `);

    // Transform and filter - exclude 0 business count
    const validSubcategories = subcategoriesRaw.rows
      .map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        name: String(row.name),
        slug: String(row.slug),
        businessCount: Number(row.business_count),
      }))
      .filter((sub) => sub.businessCount > 0);

    const totalBusinesses = validSubcategories.reduce((sum, sub) => sum + sub.businessCount, 0);

    return {
      category,
      isParent: true,
      subcategories: validSubcategories,
      totalBusinesses,
    };
  }

  // If this is a subcategory, redirect to the business listing page
  return {
    category,
    isParent: false,
    subcategories: [],
    totalBusinesses: 0,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCategoryData(slug);

  if (!data) {
    notFound();
  }

  // If it's a subcategory, redirect to the listing page
  if (!data.isParent) {
    const { redirect } = await import("next/navigation");
    redirect(`/directory/${slug}`);
  }

  const { category, subcategories, totalBusinesses } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-10">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-blue-200 mb-4">
            <Link href="/directory" className="hover:text-white">
              Directory
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">{category.name}</span>
          </nav>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {category.name}
          </h1>
          <p className="text-blue-200">
            {totalBusinesses} businesses in {subcategories.length} categories
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <SubcategoryBrowser
          subcategories={subcategories}
          categoryName={category.name}
        />

        {/* Back button */}
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/directory">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Directory
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
