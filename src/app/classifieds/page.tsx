import Link from "next/link";
import { db } from "@/lib/db";
import { classifieds, classifiedCategories } from "@/lib/db/schema";
import { desc, sql, and, eq, or, isNull, gt } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ChevronRight, Clock, Tag } from "lucide-react";
import { ClassifiedsBrowser } from "@/components/classifieds/ClassifiedsBrowser";

export const metadata = {
  title: "Classifieds - FrumToronto",
  description: "Buy, sell, and trade with the Toronto Jewish community. Jobs, housing, items for sale, and more.",
};

interface SearchParams {
  page?: string;
  q?: string;
  category?: string;
}

async function getCategories() {
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

  // Filter to only categories with listings
  return categoriesResult
    .filter((cat) => cat.name && cat.name.trim() !== "")
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      listingCount: Number(cat.listingCount || 0),
    }))
    .filter((cat) => cat.listingCount > 0);
}

async function getClassifieds(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1");
  const query = searchParams.q || "";
  const categorySlug = searchParams.category || "";
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(classifieds.isActive, true),
    eq(classifieds.approvalStatus, "approved"),
  ];

  // Only show non-expired classifieds (or those without expiry)
  const now = new Date().toISOString();

  if (query) {
    conditions.push(
      sql`(${classifieds.title} ILIKE ${`%${query}%`} OR ${classifieds.description} ILIKE ${`%${query}%`})`
    );
  }

  let categoryId: number | null = null;
  if (categorySlug) {
    const cat = await db
      .select({ id: classifiedCategories.id })
      .from(classifiedCategories)
      .where(eq(classifiedCategories.slug, categorySlug))
      .limit(1);
    if (cat[0]) {
      categoryId = cat[0].id;
      conditions.push(eq(classifieds.categoryId, categoryId));
    }
  }

  const results = await db
    .select({
      id: classifieds.id,
      title: classifieds.title,
      description: classifieds.description,
      price: classifieds.price,
      priceType: classifieds.priceType,
      location: classifieds.location,
      createdAt: classifieds.createdAt,
      expiresAt: classifieds.expiresAt,
      categoryName: classifiedCategories.name,
      categorySlug: classifiedCategories.slug,
    })
    .from(classifieds)
    .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
    .where(and(...conditions))
    .orderBy(desc(classifieds.createdAt))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(classifieds)
    .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
    .where(and(...conditions));

  const totalCount = Number(countResult[0]?.count) || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return { classifieds: results, totalCount, totalPages, page };
}

export default async function ClassifiedsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [categories, { classifieds: listings, totalCount, totalPages, page }] = await Promise.all([
    getCategories(),
    getClassifieds(params),
  ]);

  const query = params.q || "";
  const categorySlug = params.category || "";
  const selectedCategory = categories.find(c => c.slug === categorySlug);
  const hasFilters = query || categorySlug;

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Show browser view when no filters are active
  if (!hasFilters) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="h-8 w-8" />
              <h1 className="text-3xl md:text-4xl font-bold">Classifieds</h1>
            </div>
            <p className="text-orange-100 text-lg">
              Buy, sell, and trade with the Toronto Jewish community
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          <ClassifiedsBrowser categories={categories} />
        </div>
      </div>
    );
  }

  // Show filtered results view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Classifieds</h1>
          </div>
          <p className="text-orange-100 text-lg">
            {totalCount.toLocaleString()} listing{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-sm sticky top-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
                <div className="space-y-1">
                  <Link
                    href="/classifieds"
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      !categorySlug
                        ? "bg-orange-100 text-orange-800 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All Categories
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/classifieds?category=${cat.slug}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        categorySlug === cat.slug
                          ? "bg-orange-100 text-orange-800 font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs text-gray-400">{cat.listingCount}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Active Filters */}
            {(query || selectedCategory) && (
              <div className="mb-6 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">Showing:</span>
                {selectedCategory && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    {selectedCategory.name}
                  </Badge>
                )}
                {query && (
                  <Badge variant="secondary">
                    &quot;{query}&quot;
                  </Badge>
                )}
                <Link href="/classifieds" className="text-sm text-orange-600 hover:underline ml-2">
                  Clear filters
                </Link>
              </div>
            )}

            {/* Listings */}
            <div className="space-y-4">
              {listings.map((item) => (
                <Link key={item.id} href={`/classifieds/${item.id}`}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {item.categoryName && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {item.categoryName}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900 text-lg mb-2">
                            {item.title}
                          </h3>
                          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                            {item.description?.substring(0, 200)}
                            {item.description && item.description.length > 200 ? "..." : ""}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {item.createdAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(item.createdAt)}
                              </span>
                            )}
                            {item.price && (
                              <span className="font-medium text-green-600">
                                ${Number(item.price).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {listings.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No classifieds found matching your criteria.</p>
                  <Button asChild variant="link" className="mt-2">
                    <Link href="/classifieds">View all classifieds</Link>
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
                    href={`/classifieds?page=${page - 1}${query ? `&q=${query}` : ""}${categorySlug ? `&category=${categorySlug}` : ""}`}
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
                    href={`/classifieds?page=${page + 1}${query ? `&q=${query}` : ""}${categorySlug ? `&category=${categorySlug}` : ""}`}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    Next
                  </Link>
                </Button>
              </div>
            )}

            {/* Post CTA */}
            <div className="mt-8 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/classifieds/new">Post a Classified</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
