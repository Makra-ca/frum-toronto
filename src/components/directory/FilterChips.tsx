"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Filter {
  key: string;
  label: string;
  value: string;
}

interface FilterChipsProps {
  filters: Filter[];
  baseUrl: string;
  baseParams?: Record<string, string | undefined>;
}

export function FilterChips({ filters, baseUrl, baseParams = {} }: FilterChipsProps) {
  if (filters.length === 0) return null;

  const buildUrl = (excludeKey: string) => {
    const params = new URLSearchParams();

    // Add base params
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    // Add current filters except the one being removed
    filters.forEach((filter) => {
      if (filter.key !== excludeKey) {
        if (filter.key === "kosher") {
          params.set("kosher", "true");
        } else {
          params.set(filter.key, filter.value);
        }
      }
    });

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  const clearAllUrl = () => {
    const params = new URLSearchParams();
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      <span className="text-sm text-gray-500">Filters:</span>
      {filters.map((filter) => (
        <Link key={filter.key} href={buildUrl(filter.key)}>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer flex items-center gap-1 pr-1"
          >
            {filter.label === filter.value ? filter.value : `${filter.label}: ${filter.value}`}
            <X className="h-3 w-3" />
          </Badge>
        </Link>
      ))}
      {filters.length > 1 && (
        <Link
          href={clearAllUrl()}
          className="text-sm text-blue-600 hover:underline ml-2"
        >
          Clear all
        </Link>
      )}
    </div>
  );
}
