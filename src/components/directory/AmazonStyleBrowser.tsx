"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
  subcategories: Subcategory[];
}

interface TopCategory {
  name: string;
  slug: string;
  count: number;
}

interface AmazonStyleBrowserProps {
  categories: Category[];
  topCategories?: TopCategory[];
}

// Placeholder images for categories (Unsplash)
const categoryImages: Record<string, string> = {
  "restaurants-catering": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=300&fit=crop",
  "jewish-services": "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?w=600&h=300&fit=crop",
  "business-services": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop",
  "health-beauty": "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=600&h=300&fit=crop",
  "home-garden": "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=300&fit=crop",
  "financial-services": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop",
  "education": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=300&fit=crop",
  "shopping": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop",
  "simchas": "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=300&fit=crop",
  "property-accommodations": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=300&fit=crop",
  "transport-auto": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=300&fit=crop",
  "services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=300&fit=crop",
  "clothing-accessories": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=300&fit=crop",
  "kosher-foods": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop",
  "government-institutions": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=300&fit=crop",
  "sport-leisure": "https://images.unsplash.com/photo-1461896836934- voices?w=600&h=300&fit=crop",
  "media-communications": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&h=300&fit=crop",
  "travel": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=300&fit=crop",
};

const defaultImage = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=300&fit=crop";

export function AmazonStyleBrowser({ categories, topCategories = [] }: AmazonStyleBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(categories[0] || null);
  const [mobileActiveCategory, setMobileActiveCategory] = useState<Category | null>(null);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/directory/search");
    }
  };

  return (
    <div>
      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search businesses..."
              className="pl-12 pr-4 h-12 bg-white border-gray-200 rounded-lg shadow-sm"
            />
          </div>
          <Button type="submit" className="h-12 px-6 rounded-lg">
            Search
          </Button>
        </div>
      </form>

      {/* Quick Links - Top Categories */}
      {topCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {topCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/directory/${cat.slug}`}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
            >
              {cat.name} ({cat.count})
            </Link>
          ))}
        </div>
      )}

      {/* Amazon-style Two Panel Layout - Desktop Only */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex min-h-[500px]">
          {/* Left Panel - Main Categories */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="p-3 border-b border-gray-200 bg-gray-100">
              <span className="font-semibold text-gray-900 text-sm">All Categories</span>
            </div>
            <nav className="overflow-y-auto max-h-[calc(500px-48px)]">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onMouseEnter={() => setActiveCategory(category)}
                  onClick={() => router.push(`/directory/category/${category.slug}`)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                    activeCategory?.id === category.id
                      ? "bg-white text-blue-600 font-medium border-l-2 border-blue-600"
                      : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent"
                  }`}
                >
                  <span>{category.name}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </nav>
          </div>

          {/* Right Panel - Hero Image + Subcategories */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeCategory && (
              <>
                {/* Hero Image */}
                <div className="relative h-40 rounded-xl overflow-hidden mb-6">
                  <img
                    src={categoryImages[activeCategory.slug] || defaultImage}
                    alt={activeCategory.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-xl mb-1">
                      {activeCategory.name}
                    </h3>
                    <p className="text-white/80 text-sm">
                      {activeCategory.businessCount} businesses · {activeCategory.subcategories.length} categories
                    </p>
                  </div>
                  <Link
                    href={`/directory/category/${activeCategory.slug}`}
                    className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 hover:bg-white text-sm font-medium text-gray-900 rounded-lg transition-colors"
                  >
                    View All →
                  </Link>
                </div>

                {/* Subcategories */}
                {activeCategory.subcategories.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                    {activeCategory.subcategories
                      .filter((sub) => sub.businessCount > 0)
                      .map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/directory/${sub.slug}`}
                          className="py-2 text-sm text-gray-700 hover:text-blue-600 transition-colors flex items-center justify-between group"
                        >
                          <span>{sub.name}</span>
                          <span className="text-gray-400 text-xs group-hover:text-blue-400">
                            {sub.businessCount}
                          </span>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No subcategories available.{" "}
                    <Link
                      href={`/directory/category/${activeCategory.slug}`}
                      className="text-blue-600 hover:underline"
                    >
                      Browse all businesses
                    </Link>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drill-down Browser */}
      <div className="mt-6 lg:hidden">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {mobileActiveCategory ? (
            // Subcategory view (drilled down)
            <div>
              {/* Back button */}
              <button
                onClick={() => setMobileActiveCategory(null)}
                className="flex items-center gap-2 w-full px-4 py-3 text-blue-600 font-medium border-b border-gray-100 bg-gray-50"
              >
                <ChevronLeft className="h-5 w-5" />
                All Categories
              </button>

              {/* Hero image for selected category */}
              <div className="relative h-32 overflow-hidden">
                <img
                  src={categoryImages[mobileActiveCategory.slug] || defaultImage}
                  alt={mobileActiveCategory.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-white font-bold text-lg">
                    {mobileActiveCategory.name}
                  </h3>
                  <p className="text-white/80 text-xs">
                    {mobileActiveCategory.businessCount} businesses
                  </p>
                </div>
              </div>

              {/* View all link */}
              <Link
                href={`/directory/category/${mobileActiveCategory.slug}`}
                className="flex items-center justify-between px-4 py-3 text-blue-600 font-medium border-b border-gray-100 bg-blue-50/50"
              >
                <span>View All {mobileActiveCategory.name}</span>
                <ChevronRight className="h-5 w-5" />
              </Link>

              {/* Subcategories list */}
              <div className="max-h-[300px] overflow-y-auto">
                {mobileActiveCategory.subcategories
                  .filter((sub) => sub.businessCount > 0)
                  .map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/directory/${sub.slug}`}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <span className="text-gray-900">{sub.name}</span>
                      <span className="flex items-center gap-2 text-gray-400">
                        <span className="text-sm">{sub.businessCount}</span>
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          ) : (
            // Main categories view
            <div>
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Browse Categories</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setMobileActiveCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
                  >
                    <div>
                      <span className="text-gray-900 font-medium">{category.name}</span>
                      <p className="text-sm text-gray-500">
                        {category.subcategories.length} categories · {category.businessCount} businesses
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
