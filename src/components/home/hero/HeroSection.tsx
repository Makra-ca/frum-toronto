// src/components/home/hero/HeroSection.tsx
//
// Server component. Layout only: it receives every value as props and holds no
// state, no fetching and no clock. The client boundary starts at HeroLiveData.
//
// Replaces the previous 527-line client component, which did six jobs at once:
// background decoration, orbit animation, stats fetching plus a count-up
// animation, search, CTA rendering and scroll control.
//
// Layout, top to bottom: live strip full-width, then a two-column body (single
// column below `md`) with the headline, search and stat line on the left and the
// dial on the right. No eyebrow above the h1 — it restated both the headline and
// the logo. No CTA row: three of the four buttons duplicated destinations that
// are in the nav, on the dial, AND in QuickLinks below the fold.

import Link from "next/link";
import {
  HeroLiveData,
  type HeroEruv,
  type HeroZmanimSnapshot,
} from "./HeroLiveData";
import { LiveStrip } from "./LiveStrip";
import { CommunityDial } from "./CommunityDial";
import { HeroSearch } from "./HeroSearch";
import { HeroBackground } from "./HeroBackground";
import { HERO_NODES, type HeroCounts } from "./heroNodes";

interface HeroSectionProps {
  zmanim: HeroZmanimSnapshot;
  eruv: HeroEruv | null;
  counts: HeroCounts;
}

export function HeroSection({ zmanim, eruv, counts }: HeroSectionProps) {
  // Mobile destination chips are a slice of the single source of truth, not a
  // second hardcoded list.
  const mobileChips = HERO_NODES.slice(0, 3);

  return (
    <section className="relative overflow-hidden text-white">
      <HeroBackground />

      <HeroLiveData zmanim={zmanim} eruv={eruv} counts={counts}>
        <LiveStrip />

        <div className="container relative z-10 mx-auto py-10 md:py-14">
          <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-8">
            {/* Left column */}
            <div>
              <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.015em] sm:text-4xl lg:text-[2.75rem]">
                Everything the Toronto
                <br className="hidden sm:block" /> frum community needs,{" "}
                <span className="text-sky-300">in one place.</span>
              </h1>

              <p className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-slate-100">
                Shuls, kosher businesses, shiurim and this week&apos;s events — kept
                current by the people who live here.
              </p>

              <div className="mt-6">
                <HeroSearch />
              </div>

              {/* Destination chips: mobile only, where there is no dial. */}
              <div className="mt-4 flex flex-wrap gap-2 md:hidden">
                {mobileChips.map((node) => (
                  <Link
                    key={node.id}
                    href={node.href}
                    className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12.5px] text-slate-100"
                  >
                    {node.label}
                  </Link>
                ))}
              </div>

              {/* Static, i.e. unanimated. The counting animation cost 55 lines of
                  hook and made the numbers slower to read. */}
              {/* "0 events this week" is a weak thing to advertise, so that
                  segment is dropped when there are none. */}
              <p className="mt-5 text-[13px] text-slate-300">
                <span className="font-bold text-white">{counts.businesses}</span>{" "}
                businesses ·{" "}
                <span className="font-bold text-white">{counts.shuls}</span> shuls
                {counts.events > 0 && (
                  <>
                    {" · "}
                    <span className="font-bold text-white">{counts.events}</span>{" "}
                    {counts.events === 1 ? "event" : "events"} this week
                  </>
                )}
              </p>
            </div>

            {/* Right column — no dial below md. */}
            <div className="hidden md:block">
              <CommunityDial />
            </div>
          </div>
        </div>
      </HeroLiveData>
    </section>
  );
}
