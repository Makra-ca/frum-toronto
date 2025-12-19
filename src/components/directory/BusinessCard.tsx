"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, ExternalLink, Share2, ChevronRight } from "lucide-react";
import { getDirectionsUrl, getPhoneLink, formatPhoneDisplay, truncateText } from "@/lib/directory/utils";
import { OpenNowBadge } from "./OpenNowBadge";

export interface BusinessCardProps {
  business: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    hours?: unknown;
    isKosher?: boolean | null;
    kosherCertification?: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
  };
  showCategory?: boolean;
  variant?: "default" | "compact";
}

export function BusinessCard({ business, showCategory = true, variant = "default" }: BusinessCardProps) {
  const hasQuickActions = business.phone || business.address || business.website;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group">
      <CardContent className={variant === "compact" ? "p-4" : "p-5"}>
        <div className="flex gap-4">
          {/* Logo/Initial */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center overflow-hidden">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-blue-300">
                  {business.name.charAt(0)}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/directory/business/${business.slug}`}
                  className="font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                >
                  {business.name}
                </Link>
              </div>
              {business.isKosher && business.kosherCertification && (
                <Badge className="bg-green-100 text-green-800 flex-shrink-0 text-xs">
                  {business.kosherCertification}
                </Badge>
              )}
            </div>

            {/* Category & Location */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              {showCategory && business.categoryName && (
                <>
                  <span className="text-blue-600">{business.categoryName}</span>
                  <span>•</span>
                </>
              )}
              {business.city && <span>{business.city}</span>}
              {business.hours != null && (
                <>
                  <span>•</span>
                  <OpenNowBadge hours={business.hours} />
                </>
              )}
            </div>

            {/* Description */}
            {business.description && variant !== "compact" && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {truncateText(business.description, 150)}
              </p>
            )}

            {/* Quick Actions */}
            {hasQuickActions && (
              <div className="flex items-center gap-2 flex-wrap">
                {business.phone && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <a href={getPhoneLink(business.phone)}>
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </a>
                  </Button>
                )}
                {business.address && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <a
                      href={getDirectionsUrl(business.address, business.city)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Directions
                    </a>
                  </Button>
                )}
                {business.website && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <a
                      href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Website
                    </a>
                  </Button>
                )}
                <ShareButton business={business} />
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 self-center">
            <Link href={`/directory/business/${business.slug}`}>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Share button component (client-side)
function ShareButton({ business }: { business: BusinessCardProps["business"] }) {
  const handleShare = async () => {
    const url = `${window.location.origin}/directory/business/${business.slug}`;
    const shareData = {
      title: business.name,
      text: `Check out ${business.name} on FrumToronto`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        // Could show a toast here
      } catch (err) {
        // Fallback failed
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-xs text-gray-500"
      onClick={handleShare}
    >
      <Share2 className="h-3 w-3" />
    </Button>
  );
}
