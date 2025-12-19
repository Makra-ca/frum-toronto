"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";

interface FilterSidebarProps {
  cities: string[];
  kosherCerts: string[];
  categories: { name: string; slug: string }[];
  activeFiltersCount: number;
  baseSearchQuery?: string;
}

export function FilterSidebar({
  cities,
  kosherCerts,
  categories,
  activeFiltersCount,
  baseSearchQuery,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    params.delete("page");

    router.push(`/directory/search?${params.toString()}`);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    if (baseSearchQuery) {
      params.set("q", baseSearchQuery);
    }
    router.push(`/directory/search?${params.toString()}`);
  };

  return (
    <Card className="border-0 shadow-sm sticky top-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </h3>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* City Filter */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Location
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            value={searchParams.get("city") || ""}
            onChange={(e) => updateFilter("city", e.target.value || null)}
          >
            <option value="">All Locations</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Kosher Filter - commented out for now
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Kosher
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchParams.get("kosher") === "true"}
                onChange={(e) => updateFilter("kosher", e.target.checked ? "true" : null)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Kosher Only</span>
            </label>
          </div>
        </div>
        */}

        {/* Kosher Certification Filter */}
        {kosherCerts.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Certification
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              value={searchParams.get("kosherType") || ""}
              onChange={(e) => updateFilter("kosherType", e.target.value || null)}
            >
              <option value="">All Certifications</option>
              {kosherCerts.map((cert) => (
                <option key={cert} value={cert}>
                  {cert}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Category
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            value={searchParams.get("category") || ""}
            onChange={(e) => updateFilter("category", e.target.value || null)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Sort By
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            value={searchParams.get("sort") || "relevance"}
            onChange={(e) => updateFilter("sort", e.target.value)}
          >
            <option value="relevance">Relevance</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
