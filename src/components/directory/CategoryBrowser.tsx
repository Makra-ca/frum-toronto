"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, X } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  businessCount: number;
}

interface CategoryBrowserProps {
  categories: Category[];
}

export function CategoryBrowser({ categories }: CategoryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Get popular categories (top 6 by business count)
  const popularCategories = useMemo(() => {
    return [...categories]
      .sort((a, b) => b.businessCount - a.businessCount)
      .slice(0, 6);
  }, [categories]);

  // Popular search terms
  const popularSearches = [
    "Restaurants",
    "Kosher Bakeries",
    "Real Estate",
    "Lawyers",
    "Accountants",
    "Catering",
    "Photographers",
    "Tutoring",
  ];

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
      <form onSubmit={handleSearch} className="relative max-w-2xl mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search businesses by name, category, or keyword..."
              className="pl-12 pr-4 h-14 text-lg bg-white border-gray-200 rounded-xl shadow-sm"
            />
          </div>
          <Button type="submit" className="h-14 px-8 rounded-xl">
            Search
          </Button>
        </div>
      </form>

      {/* Quick Filters */}
      <div className="flex gap-2 mb-8">
        {/* Kosher Only link - commented out for frum website
        <Link
          href="/directory/search?kosher=true"
          className="inline-flex items-center px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-full text-sm font-medium transition-colors"
        >
          Kosher Only
        </Link>
        */}
        <Link
          href="/directory/search"
          className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors"
        >
          View All Businesses
        </Link>
      </div>

      {/* Popular Categories */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-3">Popular Categories</p>
        <div className="flex flex-wrap gap-2">
          {popularCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/directory/category/${cat.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-sm font-medium transition-colors"
            >
              {cat.name}
              <span className="text-blue-400">({cat.businessCount})</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Searches */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-3">Popular Searches</p>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map((term) => (
            <Link
              key={term}
              href={`/directory/search?q=${encodeURIComponent(term)}`}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 rounded-full text-sm transition-colors"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>

      {/* All Categories List */}
      <div>
        <p className="text-sm text-gray-500 mb-3">All Categories</p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/directory/category/${cat.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <span className="text-gray-900 group-hover:text-blue-600 transition-colors font-medium">
                {cat.name}
              </span>
              <span className="flex items-center gap-3 text-gray-400">
                <span className="text-sm">
                  {cat.businessCount} {cat.businessCount === 1 ? "business" : "businesses"}
                </span>
                <ChevronRight className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
