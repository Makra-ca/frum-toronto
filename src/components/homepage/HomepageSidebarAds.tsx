"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";

interface FeaturedBusiness {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  bannerImageUrl: string | null;
  logoUrl: string | null;
}

interface HomepageSidebarAdsProps {
  position: "left" | "right";
}

export function HomepageSidebarAds({ position }: HomepageSidebarAdsProps) {
  const [businesses, setBusinesses] = useState<FeaturedBusiness[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await fetch("/api/featured-businesses?placement=sidebar&limit=3");
        const data = await res.json();
        setBusinesses(data.businesses || []);
      } catch (error) {
        console.error("Error fetching sidebar businesses:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

  const nextSlide = useCallback(() => {
    if (businesses.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % businesses.length);
  }, [businesses.length]);

  const prevSlide = useCallback(() => {
    if (businesses.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + businesses.length) % businesses.length);
  }, [businesses.length]);

  // Auto-advance carousel every 6 seconds (offset from banner)
  useEffect(() => {
    if (businesses.length <= 1 || isPaused) return;

    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [businesses.length, isPaused, nextSlide]);

  if (isLoading) {
    return null;
  }

  // Show placeholder if no featured businesses
  if (businesses.length === 0) {
    return (
      <div className="w-full">
        <Link
          href="/register-business"
          className="block relative h-64 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors group bg-slate-50"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors p-4 text-center">
            <p className="text-sm font-medium">Advertise Here</p>
            <p className="text-xs mt-1">Premium visibility</p>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Vertical carousel container */}
      <div className="relative h-72 rounded-lg overflow-hidden shadow-lg bg-white">
        {businesses.map((business, index) => (
          <Link
            key={business.id}
            href={`/directory/business/${business.slug}`}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              index === currentIndex
                ? "opacity-100 translate-y-0"
                : index < currentIndex
                ? "opacity-0 -translate-y-full"
                : "opacity-0 translate-y-full"
            }`}
          >
            {/* Banner Image - vertical crop */}
            <div className="relative w-full h-40">
              {business.bannerImageUrl ? (
                <Image
                  src={business.bannerImageUrl}
                  alt={business.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700" />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Logo overlay */}
              {business.logoUrl && (
                <div className="absolute bottom-2 left-2 w-10 h-10 rounded-lg overflow-hidden bg-white shadow-md">
                  <Image
                    src={business.logoUrl}
                    alt={`${business.name} logo`}
                    fill
                    className="object-contain p-1"
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 line-clamp-1">
                {business.name}
              </h4>

              {business.tagline && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {business.tagline}
                </p>
              )}

              <span className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">
                View Listing →
              </span>
            </div>
          </Link>
        ))}

        {/* Navigation arrows (only show if more than 1 business) */}
        {businesses.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                prevSlide();
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
              aria-label="Previous business"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                nextSlide();
              }}
              className="absolute top-10 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
              aria-label="Next business"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dots indicator */}
      {businesses.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {businesses.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-blue-600 w-4"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Sponsored label */}
      <p className="text-center text-xs text-gray-400 mt-1">Sponsored</p>
    </div>
  );
}

// Mobile version - horizontal scroll layout for below explore section
export function HomepageSidebarAdsMobile() {
  const [businesses, setBusinesses] = useState<FeaturedBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await fetch("/api/featured-businesses?placement=sidebar&limit=3");
        const data = await res.json();
        setBusinesses(data.businesses || []);
      } catch (error) {
        console.error("Error fetching sidebar businesses:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

  if (isLoading || businesses.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-6 bg-slate-50">
      <div className="container mx-auto px-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Featured Businesses</h3>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/directory/business/${business.slug}`}
              className="flex-shrink-0 w-64 snap-start"
            >
              <div className="rounded-lg overflow-hidden shadow-md bg-white h-full">
                {/* Image */}
                <div className="relative w-full h-32">
                  {business.bannerImageUrl ? (
                    <Image
                      src={business.bannerImageUrl}
                      alt={business.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700" />
                  )}

                  {/* Logo overlay */}
                  {business.logoUrl && (
                    <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg overflow-hidden bg-white shadow-md">
                      <Image
                        src={business.logoUrl}
                        alt={`${business.name} logo`}
                        fill
                        className="object-contain p-0.5"
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">
                    {business.name}
                  </h4>

                  {business.tagline && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {business.tagline}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-2">Sponsored</p>
      </div>
    </section>
  );
}
