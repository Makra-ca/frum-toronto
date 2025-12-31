"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Clock } from "lucide-react";

export interface ClassifiedCategory {
  id: number;
  name: string;
  slug: string;
  listingCount: number;
}

export interface ClassifiedRecentListing {
  id: number;
  title: string;
  price: string | null;
  priceType: string;
  createdAt: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
}

export interface ClassifiedsData {
  categories: ClassifiedCategory[];
  recentListings: ClassifiedRecentListing[];
}

// Placeholder images for classified categories (Unsplash)
const categoryImages: Record<string, string> = {
  "jobs": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop",
  "for-sale": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=200&fit=crop",
  "services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop",
  "housing": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=200&fit=crop",
  "rentals": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=200&fit=crop",
  "vehicles": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=200&fit=crop",
  "electronics": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=200&fit=crop",
  "furniture": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=200&fit=crop",
  "clothing": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=200&fit=crop",
  "books": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=200&fit=crop",
  "kids": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&h=200&fit=crop",
  "simcha": "https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=200&fit=crop",
  "free": "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&h=200&fit=crop",
};

const defaultImage = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=200&fit=crop";

function formatPrice(price: string | null, priceType: string): string {
  if (priceType === "free") return "Free";
  if (!price) return "Contact for price";
  const num = parseFloat(price);
  if (priceType === "negotiable") return `$${num.toLocaleString()} (OBO)`;
  return `$${num.toLocaleString()}`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface ClassifiedsMegaMenuProps {
  data?: ClassifiedsData | null;
}

export function ClassifiedsMegaMenu({ data: prefetchedData }: ClassifiedsMegaMenuProps) {
  const [data, setData] = useState<ClassifiedsData | null>(prefetchedData || null);
  const [activeCategory, setActiveCategory] = useState<ClassifiedCategory | null>(
    prefetchedData?.categories[0] || null
  );
  const [isLoading, setIsLoading] = useState(!prefetchedData);

  // Only fetch if no prefetched data provided
  useEffect(() => {
    if (prefetchedData) return;

    fetch("/api/classifieds/categories")
      .then((res) => res.json())
      .then((result: ClassifiedsData) => {
        setData(result);
        if (result.categories.length > 0) {
          setActiveCategory(result.categories[0]);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [prefetchedData]);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading classifieds...
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="p-4">
        <Link
          href="/classifieds"
          className="block px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md"
        >
          Browse All Classifieds
        </Link>
        <Link
          href="/classifieds/new"
          className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
        >
          Post a Classified
        </Link>
      </div>
    );
  }

  // Get recent listings for the active category
  const categoryListings = activeCategory
    ? data.recentListings.filter((listing) => listing.categoryId === activeCategory.id)
    : [];

  // Get image for category (try to match slug partially)
  const getCategoryImage = (slug: string): string => {
    // Direct match
    if (categoryImages[slug]) return categoryImages[slug];
    // Partial match
    for (const [key, value] of Object.entries(categoryImages)) {
      if (slug.toLowerCase().includes(key) || key.includes(slug.toLowerCase())) {
        return value;
      }
    }
    return defaultImage;
  };

  return (
    <div className="flex w-[700px] max-h-[500px]">
      {/* Left Panel - Categories */}
      <div className="w-56 border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
        <div className="p-2">
          <Link
            href="/classifieds"
            className="block px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md mb-1"
          >
            Browse All Classifieds
          </Link>
          <Link
            href="/classifieds/new"
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md mb-1"
          >
            <Plus className="h-4 w-4" />
            Post a Classified
          </Link>
          <div className="border-t border-gray-200 my-2" />
        </div>
        <nav className="pb-2">
          {data.categories.map((category) => (
            <button
              key={category.id}
              onMouseEnter={() => setActiveCategory(category)}
              onClick={() => {
                window.location.href = `/classifieds?category=${category.slug}`;
              }}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
                activeCategory?.id === category.id
                  ? "bg-white text-blue-600 font-medium shadow-sm"
                  : "text-gray-700 hover:bg-white/50"
              }`}
            >
              <span className="truncate">{category.name}</span>
              <span className="flex items-center gap-1">
                <span className={`text-xs ${
                  activeCategory?.id === category.id ? "text-blue-400" : "text-gray-400"
                }`}>
                  {category.listingCount}
                </span>
                <ChevronRight className={`h-4 w-4 flex-shrink-0 ${
                  activeCategory?.id === category.id ? "text-blue-600" : "text-gray-400"
                }`} />
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right Panel - Hero Image + Recent Listings */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeCategory && (
          <>
            {/* Hero Image */}
            <div className="relative h-28 rounded-lg overflow-hidden mb-4">
              <img
                src={getCategoryImage(activeCategory.slug)}
                alt={activeCategory.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <h3 className="text-white font-semibold text-lg">
                  {activeCategory.name}
                </h3>
                <p className="text-white/80 text-xs">
                  {activeCategory.listingCount} listing{activeCategory.listingCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Link
                href={`/classifieds?category=${activeCategory.slug}`}
                className="absolute top-3 right-3 px-2 py-1 bg-white/90 hover:bg-white text-xs font-medium text-gray-900 rounded transition-colors"
              >
                View All →
              </Link>
            </div>

            {/* Recent Listings in this Category */}
            {categoryListings.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent in {activeCategory.name}
                </p>
                <div className="space-y-2">
                  {categoryListings.slice(0, 4).map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/classifieds/${listing.id}`}
                      className="block p-2 rounded hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 line-clamp-1">
                          {listing.title}
                        </span>
                        <span className="text-sm font-medium text-green-600 whitespace-nowrap">
                          {formatPrice(listing.price, listing.priceType)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(listing.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">
                  No recent listings in this category
                </p>
                <Link
                  href={`/classifieds?category=${activeCategory.slug}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Browse all {activeCategory.name} →
                </Link>
              </div>
            )}

            {/* Post CTA */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <Link
                href="/classifieds/new"
                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Post in {activeCategory.name}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
