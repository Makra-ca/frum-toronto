"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LiveAd } from "@/lib/ads/queries";
import { AdLightbox } from "@/components/homepage/AdLightbox";

type AdVariant = "banner" | "sidebar";

interface AdRotatorProps {
  ads: LiveAd[];
  variant: AdVariant;
  /** Distinguishes the two sidebars for screen readers. */
  label: string;
}

const ROTATE_MS: Record<AdVariant, number> = {
  // Offset from each other so the three positions do not all flip in unison,
  // which reads as the whole page twitching.
  banner: 5000,
  sidebar: 6000,
};

/**
 * Rotates through a position's ads and opens the full flyer on click.
 *
 * Images use `object-contain`, not `object-cover`. The old plan-based components
 * cropped to fill the slot, which turns a portrait community flyer into an
 * illegible horizontal strip. Letterboxing was chosen instead: the ad is shown
 * whole, and the admin warns when a shape suits a position badly.
 */
export function AdRotator({ ads, variant, label }: AdRotatorProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [expanded, setExpanded] = useState<LiveAd | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = ads.length;

  const next = useCallback(() => {
    setIndex((prev) => (count === 0 ? 0 : (prev + 1) % count));
  }, [count]);

  const previous = useCallback(() => {
    setIndex((prev) => (count === 0 ? 0 : (prev - 1 + count) % count));
  }, [count]);

  // Honour prefers-reduced-motion, and keep honouring it if the visitor changes
  // the setting while the page is open.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /*
    Auto-advance stops while the visitor is hovering, keyboard-focused inside, or
    reading the full flyer, and never starts under reduced motion.

    Auto-advancing is "moving content" under WCAG 2.2.2 and needs a pause
    mechanism. Hover alone is not one — a keyboard user cannot hover, which is
    why focus-within is here too. The arrows remain as the manual control, so
    under reduced motion the ads are still all reachable, they just do not move
    on their own.
  */
  useEffect(() => {
    if (count <= 1 || paused || reducedMotion || expanded) return;
    const timer = setInterval(next, ROTATE_MS[variant]);
    return () => clearInterval(timer);
  }, [count, paused, reducedMotion, expanded, next, variant]);

  // An ad pool can shrink between renders (an ad expires, an admin switches one
  // off). Without this the index can point past the end and render nothing.
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  if (count === 0) return <AdPlaceholder variant={variant} />;

  const isBanner = variant === "banner";
  const frameHeight = isBanner ? "h-32 md:h-40 lg:h-48" : "h-64";

  return (
    <>
      <div
        ref={containerRef}
        className="w-full"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          // Only unpause when focus leaves the whole group, not when it moves
          // between the controls inside it.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setPaused(false);
          }
        }}
        /*
          `role="region"` is load-bearing, not decoration. ARIA ignores
          `aria-label` and `aria-roledescription` on an element whose role is
          generic — which a bare <div> is. Without this the three distinct names
          ("…, top" / "…, left" / "…, right") were in the DOM, inspected fine,
          and reached no screen reader at all.
        */
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
      >
        <div
          className={`relative ${frameHeight} overflow-hidden rounded-lg bg-slate-100 shadow-sm`}
        >
          {ads.map((ad, position) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => setExpanded(ad)}
              // Hidden slides must be unreachable by keyboard, or tabbing walks
              // through invisible ads.
              tabIndex={position === index ? 0 : -1}
              aria-hidden={position !== index}
              aria-label={`${ad.title} — view full flyer`}
              className={`absolute inset-0 transition-opacity duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                position === index
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              {/*
                Not next/image: advertiser artwork has arbitrary, unknown
                dimensions, and object-contain at natural ratio is the point.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.imageUrl}
                alt={ad.title}
                className="h-full w-full object-contain"
                loading={position === 0 ? "eager" : "lazy"}
              />
            </button>
          ))}

          {count > 1 && (
            <>
              <RotatorArrow direction="previous" onClick={previous} />
              <RotatorArrow direction="next" onClick={next} />
            </>
          )}
        </div>

        {count > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {ads.map((ad, position) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show ad ${position + 1} of ${count}`}
                aria-current={position === index}
                className={`h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  position === index ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {expanded && <AdLightbox ad={expanded} onClose={() => setExpanded(null)} />}
    </>
  );
}

function RotatorArrow({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrevious ? "Previous ad" : "Next ad"}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-700 shadow transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isPrevious ? "left-2" : "right-2"
      }`}
    >
      {isPrevious ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

/**
 * Shown in every empty position, not just one.
 *
 * The pitch for the ad space is worth more than the tidier look of collapsing
 * the slot — a business only finds out the space is for sale by seeing this.
 */
function AdPlaceholder({ variant }: { variant: AdVariant }) {
  const isBanner = variant === "banner";
  return (
    <Link
      href="/register-business"
      className={`group relative block overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
        isBanner
          ? "h-32 border-slate-600 hover:border-blue-500 md:h-40"
          : "h-64 border-slate-300 bg-slate-50 hover:border-blue-500"
      }`}
    >
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center p-4 text-center transition-colors ${
          isBanner
            ? "text-slate-400 group-hover:text-blue-400"
            : "text-slate-400 group-hover:text-blue-500"
        }`}
      >
        <p className={isBanner ? "text-lg font-medium" : "text-sm font-medium"}>
          {isBanner ? "Advertise Your Business Here" : "Advertise Here"}
        </p>
        <p className={isBanner ? "mt-1 text-sm" : "mt-1 text-xs"}>
          {isBanner ? "Get premium visibility on the homepage" : "Premium visibility"}
        </p>
      </div>
    </Link>
  );
}
