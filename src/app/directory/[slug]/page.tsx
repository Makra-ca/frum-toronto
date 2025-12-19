import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { businessCategories, businesses } from "@/lib/db/schema";
import { eq, sql, asc, desc, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft, Building2 } from "lucide-react";
import { BusinessCard } from "@/components/directory/BusinessCard";
import { CategoryFilters } from "@/components/directory/CategoryFilters";

interface SearchParams {
  q?: string;
  page?: string;
  city?: string;
  kosher?: string;
  sort?: string;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

async function getCategoryData(slug: string, searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1");
  const sort = searchParams.sort || "name-asc";
  const query = searchParams.q || "";
  const city = searchParams.city || null;
  const kosherOnly = searchParams.kosher === "true";

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
    return null;
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
    LEFT JOIN businesses b ON b.category_id = bc.id AND b.is_active = true AND b.approval_status = 'approved'
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
    eq(businesses.approvalStatus, "approved"),
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
      website: businesses.website,
      logoUrl: businesses.logoUrl,
      hours: businesses.hours,
      isKosher: businesses.isKosher,
      kosherCertification: businesses.kosherCertification,
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

  return {
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
  };
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
    description: `Browse ${category[0].name} businesses in the Toronto Jewish community directory.`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const data = await getCategoryData(slug, resolvedSearchParams);

  if (!data) {
    notFound();
  }

  const { category, parentCategory, siblings, businesses: businessList, pagination, cities } = data;

  // Build query string for pagination links
  const buildQueryString = (overrides: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    if (resolvedSearchParams.q) p.set("q", resolvedSearchParams.q);
    if (resolvedSearchParams.city) p.set("city", resolvedSearchParams.city);
    if (resolvedSearchParams.kosher) p.set("kosher", resolvedSearchParams.kosher);
    if (resolvedSearchParams.sort) p.set("sort", resolvedSearchParams.sort);

    Object.entries(overrides).forEach(([key, value]) => {
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
    });

    const qs = p.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-blue-200 mb-4">
            <Link href="/directory" className="hover:text-white">
              Directory
            </Link>
            <ChevronRight className="h-4 w-4" />
            {parentCategory && (
              <>
                <Link
                  href={`/directory/category/${parentCategory.slug}`}
                  className="hover:text-white"
                >
                  {parentCategory.name}
                </Link>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            <span className="text-white">{category.name}</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold mb-2">{category.name}</h1>
          <p className="text-blue-200">
            {pagination.totalCount} business
            {pagination.totalCount !== 1 && "es"} found
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Related Categories
                </h3>
                <ul className="space-y-1 max-h-80 overflow-y-auto">
                  {siblings
                    .filter((sib) => sib.businessCount > 0)
                    .map((sib) => (
                      <li key={sib.id}>
                        <Link
                          href={`/directory/${sib.slug}`}
                          className={`flex items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                            sib.slug === slug
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <span className="truncate">{sib.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {sib.businessCount}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>

            <div className="mt-4 space-y-2">
              {parentCategory && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/directory/category/${parentCategory.slug}`}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {parentCategory.name}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/directory">All Categories</Link>
              </Button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Search & Filters */}
            <CategoryFilters categorySlug={slug} cities={cities} />

            {/* Business List */}
            {businessList.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    No businesses found matching your criteria.
                  </p>
                  <Button asChild variant="outline">
                    <Link href={`/directory/${slug}`}>Clear Filters</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {businessList.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  asChild
                  variant="outline"
                  disabled={pagination.page <= 1}
                >
                  <Link
                    href={`/directory/${slug}${buildQueryString({ page: String(pagination.page - 1) })}`}
                    className={pagination.page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Previous
                  </Link>
                </Button>
                <span className="px-4 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  asChild
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <Link
                    href={`/directory/${slug}${buildQueryString({ page: String(pagination.page + 1) })}`}
                    className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    Next
                  </Link>
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
