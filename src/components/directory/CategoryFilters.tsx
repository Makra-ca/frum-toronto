"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface CategoryFiltersProps {
  categorySlug: string;
  cities: string[];
}

export function CategoryFilters({ categorySlug, cities }: CategoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const selectedCity = searchParams.get("city") || null;
  const kosherOnly = searchParams.get("kosher") === "true";
  const sortBy = searchParams.get("sort") || "name-asc";

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change
    if (!updates.page) {
      params.delete("page");
    }

    const queryString = params.toString();
    router.push(`/directory/${categorySlug}${queryString ? `?${queryString}` : ""}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchQuery || null, page: null });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    router.push(`/directory/${categorySlug}`);
  };

  const hasActiveFilters = searchQuery || selectedCity;

  return (
    <div className="space-y-4 mb-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search businesses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">Filters:</span>

        {/* Kosher filter - commented out for frum website
        <button
          onClick={() => updateFilters({ kosher: !kosherOnly ? "true" : null })}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
            kosherOnly
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Kosher Only
          {kosherOnly && (
            <X
              className="h-3 w-3 ml-1 hover:bg-blue-700 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                updateFilters({ kosher: null });
              }}
            />
          )}
        </button>
        */}

        {/* City filter dropdown */}
        {cities.length > 0 && (
          <Select
            value={selectedCity || "all"}
            onValueChange={(value) => {
              const city = value === "all" ? null : value;
              updateFilters({ city });
            }}
          >
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort dropdown */}
        <Select
          value={sortBy}
          onValueChange={(value) => updateFilters({ sort: value })}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
