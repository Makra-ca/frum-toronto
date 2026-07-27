// src/components/home/hero/PhotoHero.tsx
//
// Photo-backed hero: a dusk photograph behind a centred headline, search, and
// the eight destinations as icon + word tiles.
//
// Why no ring here: a photograph and a tick-marked ring compete for the same
// attention, and keeping the headline readable over a photo needs a scrim dark
// enough that the picture stops being visible. Once there is a photo, the ring
// has no job left. See docs — the comparison page shows all three side by side.
//
// The scrim is the "medium" of three strengths that were compared: silhouettes,
// lit windows and the horizon glow all survive, and every piece of text stays
// comfortably readable. Lighter and the headline loses contrast where it crosses
// the bright horizon band; heavier and the photo becomes a flat blue texture.
//
// Nothing animates. No WebGL, no RAF loop, no reduced-motion branch.

import Image from "next/image";
import Link from "next/link";
import {
  HeroLiveData,
  type HeroEruv,
  type HeroZmanimSnapshot,
} from "./HeroLiveData";
import { LiveStrip } from "./LiveStrip";
import { HeroSearch } from "./HeroSearch";
import { HERO_NODES, type HeroCounts } from "./heroNodes";

interface PhotoHeroProps {
  zmanim: HeroZmanimSnapshot;
  eruv: HeroEruv | null;
  counts: HeroCounts;
}

export function PhotoHero({ zmanim, eruv, counts }: PhotoHeroProps) {
  return (
    <section className="relative overflow-hidden text-white">
      {/* Photograph. `priority` because this is the LCP element. */}
      <Image
        src="/hero-dusk.webp"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_55%]"
      />

      {/* Medium scrim — the balance point between legibility and the photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,14,30,0.72)_0%,rgba(6,14,30,0.60)_42%,rgba(8,20,42,0.93)_100%)]"
      />

      <HeroLiveData zmanim={zmanim} eruv={eruv} counts={counts}>
        <LiveStrip />

        <div className="container relative z-10 mx-auto flex flex-col items-center px-4 py-14 text-center md:py-16">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-300">
            Toronto Jewish community
          </p>

          <h1 className="font-display max-w-3xl text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] [text-shadow:0_2px_28px_rgba(0,0,0,0.55)] sm:text-4xl lg:text-[2.9rem]">
            Everything the frum community needs,{" "}
            <span className="text-sky-300">in one place.</span>
          </h1>

          <div className="mt-7 w-full max-w-[480px]">
            <HeroSearch />
          </div>

          {/* Icon + word, all eight readable at once, in a fixed order. */}
          <nav
            aria-label="Explore the site"
            className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2"
          >
            {HERO_NODES.map((node) => {
              const Icon = node.icon;
              return (
                <Link
                  key={node.id}
                  href={node.href}
                  className="flex items-center gap-2 rounded-[10px] border border-white/20 bg-[#091428]/50 px-3.5 py-2.5 backdrop-blur-sm transition-colors hover:border-sky-300 hover:bg-blue-700/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <Icon className="h-[15px] w-[15px] shrink-0 text-sky-200" />
                  <span className="whitespace-nowrap text-[12.5px] font-semibold text-slate-100">
                    {node.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <p className="mt-5 text-[12.5px] text-slate-300">
            <span className="font-bold text-white">{counts.businesses}</span>{" "}
            businesses · <span className="font-bold text-white">{counts.shuls}</span>{" "}
            shuls
            {counts.events > 0 && (
              <>
                {" · "}
                <span className="font-bold text-white">{counts.events}</span>{" "}
                {counts.events === 1 ? "event" : "events"} this week
              </>
            )}
          </p>
        </div>
      </HeroLiveData>
    </section>
  );
}
