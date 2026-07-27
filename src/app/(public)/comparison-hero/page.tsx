// src/app/(public)/comparison-hero/page.tsx
//
// A review page for the client: the three hero designs, full size, one after the
// other, so they can be judged against each other rather than from memory.
//
// Deliberately noindex — this is a shareable review link, not site content.
// Delete the route once a direction is chosen.

import type { Metadata } from "next";
import { getHeroData } from "@/lib/hero/heroData";
import { HeroSection } from "@/components/home/hero/HeroSection";
import { PhotoHero } from "@/components/home/hero/PhotoHero";
import { OriginalHero } from "./OriginalHero";
import "./original-hero.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hero comparison",
  robots: { index: false, follow: false },
};

function Divider({
  n,
  id,
  name,
  tag,
  points,
}: {
  n: string;
  id: string;
  name: string;
  tag: string;
  points: string[];
}) {
  return (
    <div id={id} className="scroll-mt-0 border-y border-slate-200 bg-slate-50">
      <div className="container mx-auto px-4 py-7">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-sky-300">
            Option {n}
          </span>
          <h2 className="text-2xl font-bold text-slate-900">{name}</h2>
          <span className="text-sm text-slate-500">{tag}</span>
        </div>
        <ul className="mt-3 grid gap-x-8 gap-y-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function ComparisonHeroPage() {
  const hero = await getHeroData();

  return (
    <div className="bg-white">
      <div className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-900">
            FrumToronto — homepage hero, three options
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Each version below is the real, working hero at full size — not a
            picture of one. Live times, live counts, and every link works. Scroll
            through all three and compare.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <a href="#option-1" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-900">
              1 · Current live site
            </a>
            <a href="#option-2" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-900">
              2 · The dial
            </a>
            <a href="#option-3" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-900">
              3 · Photograph
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Times shown are today&apos;s, for Toronto.
          </p>
        </div>
      </div>

      <Divider
        n="1"
        id="option-1"
        name="Current live site"
        tag="what is on frumtoronto.com today"
        points={[
          "Nine sections orbiting the FrumToronto badge",
          "Each section a different colour",
          "Animated star background",
          "Labels are small and shrink when not hovered",
          "Sections keep moving while you try to click them",
        ]}
      />
      <div data-hero="1">
        <OriginalHero />
      </div>

      <Divider
        n="2"
        id="option-2"
        name="The dial"
        tag="first redesign"
        points={[
          "One accent colour instead of nine",
          "Tick ring marks the day, like a clock face",
          "Centre shows tonight's candle lighting",
          "Rotation is 6× slower and stops when you point at it",
          "Candle lighting, eruv and the Hebrew date in the top strip",
        ]}
      />
      <div data-hero="2">
        <HeroSection zmanim={hero.zmanim} eruv={hero.eruv} counts={hero.counts} />
      </div>

      <Divider
        n="3"
        id="option-3"
        name="Photograph"
        tag="latest proposal"
        points={[
          "A dusk photograph carries the mood",
          "Headline and search dead centre, nothing competing",
          "All eight sections shown as labelled buttons",
          "Nothing moves at all",
          "Same live candle lighting and eruv strip on top",
        ]}
      />
      <div data-hero="3">
        <PhotoHero zmanim={hero.zmanim} eruv={hero.eruv} counts={hero.counts} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="container mx-auto px-4 py-10 text-sm text-slate-500">
          Internal review page. Not linked from the site and not indexed by search
          engines.
        </div>
      </div>
    </div>
  );
}
