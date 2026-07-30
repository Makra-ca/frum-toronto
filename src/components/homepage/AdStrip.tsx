"use client";

import { useState } from "react";
import type { LiveAd } from "@/lib/ads/queries";
import { AdLightbox } from "@/components/homepage/AdLightbox";

/**
 * The mobile ad row: a horizontally scrollable strip rather than a rotation.
 *
 * Deliberately not a carousel. On a phone the visitor can already flick through
 * these directly, so auto-advancing would move content under their thumb for no
 * benefit — and it would need its own pause affordance to satisfy WCAG 2.2.2.
 * Scrolling is the native version of the same thing.
 */
export function AdStrip({ ads }: { ads: LiveAd[] }) {
  const [expanded, setExpanded] = useState<LiveAd | null>(null);

  if (ads.length === 0) return null;

  return (
    <>
      <section className="w-full py-2">
        <ul
          className="-mx-4 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto px-4 pb-2"
          aria-label="Featured advertisers"
        >
          {ads.map((ad) => (
            /*
              The listitem must be the wrapper, not the button. Putting
              role="listitem" on the <button> overrides its implicit button role,
              so assistive tech stops announcing it as activatable at all.
            */
            <li key={ad.id} className="flex-shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setExpanded(ad)}
                aria-label={`${ad.title} — view full flyer`}
                className="w-56 overflow-hidden rounded-lg bg-slate-100 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="h-32 w-full object-contain"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {expanded && <AdLightbox ad={expanded} onClose={() => setExpanded(null)} />}
    </>
  );
}
