"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, X } from "lucide-react";

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
}

interface SubcategoryBrowserProps {
  subcategories: Subcategory[];
  categoryName: string;
}

export function SubcategoryBrowser({ subcategories, categoryName }: SubcategoryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Get popular categories (top 8 by business count)
  const popularCategories = useMemo(() => {
    return [...subcategories]
      .sort((a, b) => b.businessCount - a.businessCount)
      .slice(0, 8);
  }, [subcategories]);

  // Filter subcategories based on search
  const filteredSubcategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return subcategories;
    }
    const query = searchQuery.toLowerCase();
    return subcategories.filter((sub) =>
      sub.name.toLowerCase().includes(query)
    );
  }, [subcategories, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div>
      {/* Search Input */}
      <div className="relative max-w-xl mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${subcategories.length} categories...`}
          className="pl-12 pr-10 h-14 text-lg bg-white border-gray-200 rounded-xl shadow-sm"
          autoFocus
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Popular Tags (show when not searching) */}
      {!isSearching && (
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-3">Popular in {categoryName}</p>
          <div className="flex flex-wrap gap-2">
            {popularCategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/directory/${sub.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-sm font-medium transition-colors"
              >
                {sub.name}
                <span className="text-blue-400">({sub.businessCount})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results count when searching */}
      {isSearching && (
        <p className="text-sm text-gray-500 mb-4">
          {filteredSubcategories.length} {filteredSubcategories.length === 1 ? "result" : "results"} for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* Subcategory List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {filteredSubcategories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No categories found matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredSubcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/directory/${sub.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <span className="text-gray-900 group-hover:text-blue-600 transition-colors">
                {sub.name}
              </span>
              <span className="flex items-center gap-3 text-gray-400">
                <span className="text-sm">
                  {sub.businessCount} {sub.businessCount === 1 ? "business" : "businesses"}
                </span>
                <ChevronRight className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
              </span>
            </Link>
          ))
        )}
      </div>

      {/* Show all link when searching */}
      {isSearching && filteredSubcategories.length > 0 && (
        <button
          onClick={() => setSearchQuery("")}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Show all {subcategories.length} categories
        </button>
      )}
    </div>
  );
}
