"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Search, Loader2, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClassifiedsData } from "./ClassifiedsMegaMenu";

interface ClassifiedsMobileDrilldownProps {
  onClose: () => void;
  data?: ClassifiedsData | null;
}

function formatPrice(price: string | null, priceType: string): string {
  if (priceType === "free") return "Free";
  if (!price) return "";
  const num = parseFloat(price);
  return `$${num.toLocaleString()}`;
}

export function ClassifiedsMobileDrilldown({ onClose, data: prefetchedData }: ClassifiedsMobileDrilldownProps) {
  const [data, setData] = useState<ClassifiedsData | null>(prefetchedData || null);
  const [isLoading, setIsLoading] = useState(!prefetchedData);
  const [searchQuery, setSearchQuery] = useState("");

  // Only fetch if no prefetched data provided
  useEffect(() => {
    if (prefetchedData) return;

    fetch("/api/classifieds/categories")
      .then((res) => res.json())
      .then((result: ClassifiedsData) => {
        setData(result);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [prefetchedData]);

  // Filter categories based on search
  const filteredCategories = data?.categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Classifieds</h3>
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
          href="/classifieds"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-blue-600 font-medium"
        >
          <span>Browse All Classifieds</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
        <Link
          href="/classifieds/new"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-green-600 font-medium"
        >
          <Plus className="h-5 w-5" />
          <span className="flex-1 ml-2">Post a Classified</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
        <Link
          href="/specials"
          onClick={onClose}
          className="flex items-center justify-between py-2 text-orange-600 font-medium"
        >
          <Tag className="h-5 w-5" />
          <span className="flex-1 ml-2">Weekly Specials</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Recent listings preview */}
      {data && data.recentListings.length > 0 && !searchQuery && (
        <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/30">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Recent Listings
          </p>
          {data.recentListings.slice(0, 3).map((listing) => (
            <Link
              key={listing.id}
              href={`/classifieds/${listing.id}`}
              onClick={onClose}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-gray-700 truncate flex-1 mr-2">{listing.title}</span>
              <span className="text-green-600 font-medium whitespace-nowrap">
                {formatPrice(listing.price, listing.priceType)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Categories list */}
      <div className="flex-1 overflow-y-auto">
        {!searchQuery && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Categories
            </p>
          </div>
        )}
        {filteredCategories.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No categories found
          </div>
        ) : (
          filteredCategories.map((category) => (
            <Link
              key={category.id}
              href={`/classifieds?category=${category.slug}`}
              onClick={onClose}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100"
            >
              <span className="text-gray-900 font-medium">{category.name}</span>
              <span className="flex items-center gap-2 text-gray-400">
                <span className="text-sm">{category.listingCount}</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
