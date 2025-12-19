"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, Plus } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  listingCount: number;
}

interface ClassifiedsBrowserProps {
  categories: Category[];
}

// Placeholder images for classified categories (Unsplash)
const categoryImages: Record<string, string> = {
  "jobs": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=300&fit=crop",
  "jobs-available": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=300&fit=crop",
  "jobs-wanted": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&h=300&fit=crop",
  "for-sale": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop",
  "services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=300&fit=crop",
  "housing": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=300&fit=crop",
  "apartment-rental": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=300&fit=crop",
  "homes-rental": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=300&fit=crop",
  "vehicles": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=300&fit=crop",
  "auto-sales": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=300&fit=crop",
  "electronics": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=300&fit=crop",
  "furniture": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=300&fit=crop",
  "clothing": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=300&fit=crop",
  "clothes-childrens": "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&h=300&fit=crop",
  "clothes-womens": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=300&fit=crop",
  "books": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop",
  "sefarim-books": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop",
  "kids": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=300&fit=crop",
  "simcha": "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=300&fit=crop",
  "free": "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&h=300&fit=crop",
  "babysitters": "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=600&h=300&fit=crop",
  "nannies": "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=600&h=300&fit=crop",
  "tutoring": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=300&fit=crop",
  "camps": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&h=300&fit=crop",
  "travel": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=300&fit=crop",
};

const defaultImage = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=300&fit=crop";

function getCategoryImage(slug: string): string {
  if (categoryImages[slug]) return categoryImages[slug];
  // Try partial match
  for (const [key, value] of Object.entries(categoryImages)) {
    if (slug.includes(key) || key.includes(slug)) {
      return value;
    }
  }
  return defaultImage;
}

export function ClassifiedsBrowser({ categories }: ClassifiedsBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(categories[0] || null);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/classifieds?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Popular search terms for classifieds
  const popularSearches = [
    "Jobs",
    "Apartments",
    "Babysitter",
    "Furniture",
    "Tutoring",
    "Carpool",
  ];

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
              placeholder="Search classifieds..."
              className="pl-12 pr-4 h-12 bg-white border-gray-200 rounded-lg shadow-sm"
            />
          </div>
          <Button type="submit" className="h-12 px-6 rounded-lg bg-orange-600 hover:bg-orange-700">
            Search
          </Button>
        </div>
      </form>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/classifieds/new"
          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded text-sm font-medium transition-colors flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Post a Classified
        </Link>
        {popularSearches.map((term) => (
          <Link
            key={term}
            href={`/classifieds?q=${encodeURIComponent(term)}`}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            {term}
          </Link>
        ))}
      </div>

      {/* Two Panel Layout - Desktop Only */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex min-h-[400px]">
          {/* Left Panel - Categories */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="p-3 border-b border-gray-200 bg-gray-100">
              <span className="font-semibold text-gray-900 text-sm">All Categories</span>
            </div>
            <nav className="overflow-y-auto max-h-[calc(400px-48px)]">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onMouseEnter={() => setActiveCategory(category)}
                  onClick={() => router.push(`/classifieds?category=${category.slug}`)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                    activeCategory?.id === category.id
                      ? "bg-white text-orange-600 font-medium border-l-2 border-orange-600"
                      : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent"
                  }`}
                >
                  <span>{category.name}</span>
                  <span className="flex items-center gap-2">
                    <span className={`text-xs ${activeCategory?.id === category.id ? "text-orange-400" : "text-gray-400"}`}>
                      {category.listingCount}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right Panel - Category Preview */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeCategory && (
              <>
                {/* Hero Image */}
                <div className="relative h-48 rounded-xl overflow-hidden mb-6">
                  <img
                    src={getCategoryImage(activeCategory.slug)}
                    alt={activeCategory.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-2xl mb-1">
                      {activeCategory.name}
                    </h3>
                    <p className="text-white/80 text-sm">
                      {activeCategory.listingCount} listing{activeCategory.listingCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/classifieds?category=${activeCategory.slug}`}
                    className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 hover:bg-white text-sm font-medium text-gray-900 rounded-lg transition-colors"
                  >
                    Browse →
                  </Link>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link
                    href={`/classifieds?category=${activeCategory.slug}`}
                    className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white text-center font-medium rounded-lg transition-colors"
                  >
                    View {activeCategory.listingCount} Listing{activeCategory.listingCount !== 1 ? "s" : ""}
                  </Link>
                  <Link
                    href="/classifieds/new"
                    className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Post in {activeCategory.name}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Category Grid */}
      <div className="lg:hidden">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Browse Categories</h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/classifieds?category=${category.slug}`}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="text-gray-900 font-medium">{category.name}</span>
                <span className="flex items-center gap-2 text-gray-400">
                  <span className="text-sm">{category.listingCount}</span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
