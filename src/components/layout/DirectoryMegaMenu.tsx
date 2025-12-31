"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
}

export interface DirectoryCategory {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
  subcategories: Subcategory[];
}

// Placeholder images for categories (Unsplash)
const categoryImages: Record<string, string> = {
  "restaurants-catering": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=200&fit=crop",
  "jewish-services": "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?w=400&h=200&fit=crop",
  "business-services": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop",
  "health-beauty": "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=200&fit=crop",
  "home-garden": "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=200&fit=crop",
  "financial-services": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=200&fit=crop",
  "education": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=200&fit=crop",
  "shopping": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=200&fit=crop",
  "simchas": "https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=200&fit=crop",
  "property-accommodations": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=200&fit=crop",
  "transport-auto": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=200&fit=crop",
  "services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop",
};

const defaultImage = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop";

interface DirectoryMegaMenuProps {
  categories?: DirectoryCategory[] | null;
}

export function DirectoryMegaMenu({ categories: prefetchedCategories }: DirectoryMegaMenuProps) {
  const [categories, setCategories] = useState<DirectoryCategory[]>(prefetchedCategories || []);
  const [activeCategory, setActiveCategory] = useState<DirectoryCategory | null>(
    prefetchedCategories?.[0] || null
  );
  const [isLoading, setIsLoading] = useState(!prefetchedCategories);

  // Only fetch if no prefetched data provided
  useEffect(() => {
    if (prefetchedCategories) return;

    fetch("/api/directory/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        if (data.length > 0) {
          setActiveCategory(data[0]);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [prefetchedCategories]);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="flex w-[700px] max-h-[500px]">
      {/* Left Panel - Categories */}
      <div className="w-56 border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
        <div className="p-2">
          <Link
            href="/directory"
            className="block px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md mb-1"
          >
            Browse All Categories
          </Link>
          <Link
            href="/directory/search"
            className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md mb-1"
          >
            Search Directory
          </Link>
          <div className="border-t border-gray-200 my-2" />
        </div>
        <nav className="pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onMouseEnter={() => setActiveCategory(category)}
              onClick={() => {
                window.location.href = `/directory/category/${category.slug}`;
              }}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
                activeCategory?.id === category.id
                  ? "bg-white text-blue-600 font-medium shadow-sm"
                  : "text-gray-700 hover:bg-white/50"
              }`}
            >
              <span className="truncate">{category.name}</span>
              <ChevronRight className={`h-4 w-4 flex-shrink-0 ${
                activeCategory?.id === category.id ? "text-blue-600" : "text-gray-400"
              }`} />
            </button>
          ))}
        </nav>
      </div>

      {/* Right Panel - Subcategories + Hero Image */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeCategory && (
          <>
            {/* Hero Image */}
            <div className="relative h-28 rounded-lg overflow-hidden mb-4">
              <img
                src={categoryImages[activeCategory.slug] || defaultImage}
                alt={activeCategory.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <h3 className="text-white font-semibold text-lg">
                  {activeCategory.name}
                </h3>
                <p className="text-white/80 text-xs">
                  {activeCategory.businessCount} businesses
                </p>
              </div>
            </div>

            {/* Subcategories Grid */}
            {activeCategory.subcategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {activeCategory.subcategories
                  .filter((sub) => sub.businessCount > 0)
                  .slice(0, 12)
                  .map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/directory/${sub.slug}`}
                      className="py-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors truncate"
                    >
                      {sub.name}
                    </Link>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Browse all {activeCategory.name.toLowerCase()} businesses
              </p>
            )}

            {/* See All Link */}
            {activeCategory.subcategories.length > 12 && (
              <Link
                href={`/directory/category/${activeCategory.slug}`}
                className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                See all {activeCategory.subcategories.length} categories →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
