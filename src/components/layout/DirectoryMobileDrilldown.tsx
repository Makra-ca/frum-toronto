"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

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

interface DirectoryMobileDrilldownProps {
  onClose: () => void;
}

export function DirectoryMobileDrilldown({ onClose }: DirectoryMobileDrilldownProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/directory/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Filter subcategories based on search (only when viewing a category)
  const filteredSubcategories = activeCategory?.subcategories.filter((sub) =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Filter categories based on search (only when viewing main list)
  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Subcategory view (drilled down)
  if (activeCategory) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <button
          onClick={() => {
            setActiveCategory(null);
            setSearchQuery("");
          }}
          className="flex items-center gap-2 px-4 py-3 text-blue-600 font-medium border-b border-gray-100"
        >
          <ChevronLeft className="h-5 w-5" />
          Back to Categories
        </button>

        {/* Category title */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{activeCategory.name}</h3>
          <p className="text-sm text-gray-500">
            {activeCategory.businessCount} businesses
          </p>
        </div>

        {/* Search within category */}
        {activeCategory.subcategories.length > 5 && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subcategories..."
                className="pl-9 h-10"
              />
            </div>
          </div>
        )}

        {/* View all link */}
        <Link
          href={`/directory/category/${activeCategory.slug}`}
          onClick={onClose}
          className="flex items-center justify-between px-4 py-3 text-blue-600 font-medium border-b border-gray-100 bg-blue-50/50"
        >
          <span>View All {activeCategory.name}</span>
          <ChevronRight className="h-5 w-5" />
        </Link>

        {/* Subcategories list */}
        <div className="flex-1 overflow-y-auto">
          {filteredSubcategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No subcategories found
            </div>
          ) : (
            filteredSubcategories
              .filter((sub) => sub.businessCount > 0)
              .map((sub) => (
                <Link
                  key={sub.id}
                  href={`/directory/${sub.slug}`}
                  onClick={onClose}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-gray-900">{sub.name}</span>
                  <span className="flex items-center gap-2 text-gray-400">
                    <span className="text-sm">{sub.businessCount}</span>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              ))
          )}
        </div>
      </div>
    );
  }

  // Main categories view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Business Directory</h3>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        <Link
          href="/directory"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-blue-600 font-medium"
        >
          <span>Browse All Categories</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
        <Link
          href="/directory/search"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-gray-700"
        >
          <span>Search All Businesses</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        {/* Kosher Businesses link - commented out for frum website
        <Link
          href="/directory/search?kosher=true"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-green-700"
        >
          <span>Kosher Businesses</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        */}
      </div>

      {/* Categories list */}
      <div className="flex-1 overflow-y-auto">
        {filteredCategories.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No categories found
          </div>
        ) : (
          filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category);
                setSearchQuery("");
              }}
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
          ))
        )}
      </div>
    </div>
  );
}
