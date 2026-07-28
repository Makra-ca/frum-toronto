"use client";

// src/components/home/hero/LiveStrip.tsx
//
// One line above the headline: the primary zman, eruv status, Hebrew date.
//
// Purely presentational — it reads the context and renders. No fetching, no
// location logic, no clock. This content is not new to the homepage; it is
// ZmanimWidget and EruvWidget relocated from the very bottom of the page, below
// six sections, to above the fold.
//
// Nothing here ever renders a placeholder. If a value is unavailable its segment
// is omitted, because "--:--" reads as broken.

import Link from "next/link";
import { formatZman } from "@/lib/zmanim-format";
import { isTorontoLocation } from "@/lib/zmanim-location";
import { useHeroLive } from "./HeroLiveData";

export function LiveStrip() {
  const { location, primaryZman, hebrewDateHebrew, parsha, eruv, isTimesResolved } =
    useHeroLive();

  const showLocationName = !isTorontoLocation(location);

  return (
    // No background tint and no bottom border: the strip sits directly on the
    // hero backdrop and reads as part of it. A tinted band plus a hairline rule
    // made the top of the hero look like a separate, pasted-on element.
    // `relative z-10` stays — it lifts the strip above HeroBackground.
    // pt-[92px] clears the fixed pill nav (78px tall incl. its top offset) floating above it. Without this the
    // zmanim line would sit behind the bar at the very top of the hero.
    <div aria-busy={!isTimesResolved} className="relative z-10 pt-[92px]">
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[13px] text-slate-100">
        {primaryZman && (
          <Link
            href="/zmanim"
            className="group inline-flex items-center gap-2 transition-colors hover:text-white"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span>
              {showLocationName && (
                <span className="text-slate-200">{location.label} · </span>
              )}
              {primaryZman.label}{" "}
              <span className="font-semibold tabular-nums text-white">
                {formatZman(primaryZman.time, location.tzid, primaryZman.direction)}
              </span>
            </span>
          </Link>
        )}

        {/* Plain text, not a link: there is no public /eruv page. */}
        {eruv && (
          <>
            <span aria-hidden="true" className="text-slate-400">
              |
            </span>
            <span>
              Eruv{" "}
              <span
                className={
                  eruv.isUp ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"
                }
              >
                {eruv.isUp ? "UP" : "DOWN"}
              </span>
            </span>
          </>
        )}

        {/* Parsha kept LTR and separate: hebcal returns it transliterated
            ("Vaetchanan"), so wrapping it in the RTL Hebrew-date span would mix
            scripts inside one direction context and render badly. */}
        <span className="ms-auto flex items-baseline gap-2">
          {parsha && <span className="text-slate-200">Parshas {parsha}</span>}
          <span className="font-display text-[14px] text-sky-200/80" dir="rtl">
            {hebrewDateHebrew}
          </span>
        </span>
      </div>
    </div>
  );
}
