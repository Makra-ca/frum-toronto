import Link from "next/link";
import { db } from "@/lib/db";
import { businesses, businessCategories } from "@/lib/db/schema";
import { eq, sql, asc, desc, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2 } from "lucide-react";
import { BusinessCard } from "@/components/directory/BusinessCard";
import { FilterChips } from "@/components/directory/FilterChips";
import { FilterSidebar } from "@/components/directory/FilterSidebar";

export const metadata = {
  title: "Search Business Directory - FrumToronto",
  description: "Search for businesses in the Toronto Jewish community directory.",
};

interface SearchParams {
  q?: string;
  page?: string;
  city?: string;
  kosher?: string;
  kosherType?: string;
  category?: string;
  sort?: string;
}

async function searchBusinesses(params: SearchParams) {
  const query = params.q || "";
  const page = parseInt(params.page || "1");
  const city = params.city || null;
  const kosherOnly = params.kosher === "true";
  const kosherType = params.kosherType || null;
  const categorySlug = params.category || null;
  const sort = params.sort || "relevance";

  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Build conditions
  const conditions = [
    eq(businesses.isActive, true),
    eq(businesses.approvalStatus, "approved"),
  ];

  // Search query
  if (query) {
    conditions.push(
      sql`(
        ${businesses.name} ILIKE ${"%" + query + "%"}
        OR ${businesses.description} ILIKE ${"%" + query + "%"}
      )`
    );
  }

  if (city) {
    conditions.push(eq(businesses.city, city));
  }

  if (kosherOnly) {
    conditions.push(eq(businesses.isKosher, true));
  }

  if (kosherType) {
    conditions.push(eq(businesses.kosherCertification, kosherType));
  }

  let categoryId: number | null = null;
  if (categorySlug) {
    const cat = await db
      .select({ id: businessCategories.id })
      .from(businessCategories)
      .where(eq(businessCategories.slug, categorySlug))
      .limit(1);
    if (cat[0]) {
      categoryId = cat[0].id;
      conditions.push(eq(businesses.categoryId, categoryId));
    }
  }

  // Sort
  console.log("=== SORT DEBUG ===");
  console.log("Sort param received:", sort);
  console.log("Sort param type:", typeof sort);
  console.log("Sort === 'name-asc':", sort === "name-asc");

  let orderBy;
  switch (sort) {
    case "name-asc":
      console.log("MATCHED: name-asc case");
      orderBy = asc(sql`LOWER(TRIM(${businesses.name}))`);
      break;
    case "name-desc":
      console.log("MATCHED: name-desc case");
      orderBy = desc(sql`LOWER(TRIM(${businesses.name}))`);
      break;
    case "newest":
      console.log("MATCHED: newest case");
      orderBy = desc(businesses.createdAt);
      break;
    default:
      console.log("MATCHED: default case (relevance)");
      orderBy = sql`
        CASE WHEN ${businesses.isFeatured} = true THEN 0 ELSE 1 END,
        ${businesses.viewCount} DESC NULLS LAST,
        LOWER(TRIM(${businesses.name})) ASC
      `;
  }
  console.log("OrderBy value:", orderBy);
  console.log("=== END SORT DEBUG ===");

  // Get businesses
  const results = await db
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
      categoryName: businessCategories.name,
      categorySlug: businessCategories.slug,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  // Debug: Log first 5 results
  console.log("=== RESULTS DEBUG ===");
  console.log("First 5 business names:", results.slice(0, 5).map(b => b.name));
  console.log("=== END RESULTS DEBUG ===");

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(businesses)
    .where(and(...conditions));

  const totalCount = Number(countResult[0]?.count) || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return { businesses: results, totalCount, totalPages, page };
}

async function getFilterOptions() {
  // Get cities
  const citiesResult = await db
    .select({ city: businesses.city })
    .from(businesses)
    .where(
      and(
        eq(businesses.isActive, true),
        sql`${businesses.city} IS NOT NULL AND ${businesses.city} != ''`
      )
    )
    .groupBy(businesses.city)
    .orderBy(businesses.city);

  const cities = citiesResult.map((r) => r.city).filter((c): c is string => c !== null);

  // Get kosher certifications
  const kosherResult = await db
    .select({ cert: businesses.kosherCertification })
    .from(businesses)
    .where(
      and(
        eq(businesses.isActive, true),
        eq(businesses.isKosher, true),
        sql`${businesses.kosherCertification} IS NOT NULL AND ${businesses.kosherCertification} != ''`
      )
    )
    .groupBy(businesses.kosherCertification)
    .orderBy(businesses.kosherCertification);

  const kosherCerts = kosherResult.map((r) => r.cert).filter((c): c is string => c !== null);

  // Get categories
  const categoriesResult = await db
    .select({
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

  return { cities, kosherCerts, categories: categoriesResult };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [searchResults, filterOptions] = await Promise.all([
    searchBusinesses(params),
    getFilterOptions(),
  ]);

  const { businesses: results, totalCount, totalPages, page } = searchResults;
  const query = params.q || "";

  // Build filter params for pagination links
  const buildQueryString = (overrides: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.city) p.set("city", params.city);
    if (params.kosher) p.set("kosher", params.kosher);
    if (params.kosherType) p.set("kosherType", params.kosherType);
    if (params.category) p.set("category", params.category);
    if (params.sort) p.set("sort", params.sort);

    Object.entries(overrides).forEach(([key, value]) => {
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
    });

    return p.toString();
  };

  // Active filters for chips
  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (params.city) activeFilters.push({ key: "city", label: "City", value: params.city });
  // Kosher filters - commented out for frum website
  // if (params.kosher === "true") activeFilters.push({ key: "kosher", label: "Kosher Only", value: "true" });
  // if (params.kosherType) activeFilters.push({ key: "kosherType", label: "Certification", value: params.kosherType });
  if (params.category) {
    const cat = filterOptions.categories.find((c) => c.slug === params.category);
    if (cat) activeFilters.push({ key: "category", label: "Category", value: cat.name });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-7 w-7" />
            <h1 className="text-2xl md:text-3xl font-bold">Search Directory</h1>
          </div>

          {/* Search Form */}
          <form className="max-w-2xl mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Search businesses..."
                  className="pl-12 h-12 bg-white text-gray-900 border-0 text-base rounded-xl"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700">
                Search
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Filters */}
          <aside className="lg:col-span-1">
            <FilterSidebar
              cities={filterOptions.cities}
              kosherCerts={filterOptions.kosherCerts}
              categories={filterOptions.categories}
              activeFiltersCount={activeFilters.length}
              baseSearchQuery={query}
            />
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            {/* Results Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  {query ? (
                    <p className="text-gray-600">
                      <span className="font-medium">{totalCount}</span> results for &quot;{query}&quot;
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      <span className="font-medium">{totalCount}</span> businesses
                    </p>
                  )}
                </div>
              </div>

              {/* Active Filters */}
              {activeFilters.length > 0 && (
                <FilterChips
                  filters={activeFilters}
                  baseUrl="/directory/search"
                  baseParams={{ q: query }}
                />
              )}
            </div>

            {/* Results */}
            <div className="space-y-4">
              {results.map((business) => (
                <BusinessCard key={business.id} business={business} showCategory />
              ))}
            </div>

            {results.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No businesses found matching your search.</p>
                  <Button asChild variant="outline">
                    <Link href="/directory">Browse Directory</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  asChild
                  variant="outline"
                  disabled={page <= 1}
                >
                  <Link
                    href={`/directory/search?${buildQueryString({ page: String(page - 1) })}`}
                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Previous
                  </Link>
                </Button>
                <span className="px-4 text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  asChild
                  variant="outline"
                  disabled={page >= totalPages}
                >
                  <Link
                    href={`/directory/search?${buildQueryString({ page: String(page + 1) })}`}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
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
