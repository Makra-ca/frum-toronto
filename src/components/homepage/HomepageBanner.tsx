"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface FeaturedBusiness {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  bannerImageUrl: string | null;
  logoUrl: string | null;
}

export function HomepageBanner() {
  const [businesses, setBusinesses] = useState<FeaturedBusiness[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await fetch("/api/featured-businesses?placement=banner&limit=3");
        const data = await res.json();
        setBusinesses(data.businesses || []);
      } catch (error) {
        console.error("Error fetching banner businesses:", error);
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

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    if (businesses.length <= 1 || isPaused) return;

    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [businesses.length, isPaused, nextSlide]);

  // Don't render if loading or no businesses
  if (isLoading) {
    return null;
  }

  // Show placeholder if no featured businesses
  if (businesses.length === 0) {
    return (
      <section className="w-full bg-gradient-to-r from-slate-900 to-slate-800 py-4">
        <div className="container mx-auto px-4">
          <Link
            href="/register-business"
            className="block relative h-32 md:h-40 rounded-lg overflow-hidden border-2 border-dashed border-slate-600 hover:border-blue-500 transition-colors group"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
              <p className="text-lg font-medium">Advertise Your Business Here</p>
              <p className="text-sm mt-1">Get premium visibility on the homepage</p>
            </div>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-gradient-to-r from-slate-900 to-slate-800 py-4">
      <div className="container mx-auto px-4">
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Carousel container */}
          <div className="relative h-32 md:h-40 lg:h-48 rounded-lg overflow-hidden">
            {businesses.map((business, index) => (
              <Link
                key={business.id}
                href={`/directory/business/${business.slug}`}
                className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  index === currentIndex
                    ? "opacity-100 translate-x-0"
                    : index < currentIndex
                    ? "opacity-0 -translate-x-full"
                    : "opacity-0 translate-x-full"
                }`}
              >
                {/* Banner Image */}
                <div className="relative w-full h-full">
                  {business.bannerImageUrl ? (
                    <Image
                      src={business.bannerImageUrl}
                      alt={business.name}
                      fill
                      className="object-cover"
                      priority={index === 0}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-blue-600 to-blue-800" />
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex items-center px-6 md:px-10">
                    <div className="max-w-xl">
                      {/* Logo if available */}
                      {business.logoUrl && (
                        <div className="w-12 h-12 md:w-16 md:h-16 mb-2 relative rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm">
                          <Image
                            src={business.logoUrl}
                            alt={`${business.name} logo`}
                            fill
                            className="object-contain p-1"
                          />
                        </div>
                      )}

                      <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-1">
                        {business.name}
                      </h3>

                      {business.tagline && (
                        <p className="text-sm md:text-base text-white/90 line-clamp-2">
                          {business.tagline}
                        </p>
                      )}

                      <span className="inline-block mt-3 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors">
                        Visit Listing →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Navigation arrows (only show if more than 1 business) */}
          {businesses.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  prevSlide();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
                aria-label="Previous business"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  nextSlide();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
                aria-label="Next business"
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </>
          )}

          {/* Dots indicator */}
          {businesses.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {businesses.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? "bg-white w-6"
                      : "bg-white/50 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sponsored label */}
        <p className="text-center text-xs text-slate-500 mt-2">Sponsored</p>
      </div>
    </section>
  );
}
