// src/lib/hero/heroData.ts
//
// Server-side data for the hero, in one place so page.tsx stays a layout file.
//
// Everything here runs on the server per request, which is why page.tsx must
// declare `force-dynamic`: without it Next.js would statically prerender the page
// and bake build-time candle lighting, eruv status and counts into the HTML
// permanently. The two API routes whose work this replaces both carry
// `force-dynamic` today.

import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { safeQuery } from "@/lib/db/safe-query";
import { businesses, shuls, events, eruvStatus } from "@/lib/db/schema";
import { getZmanimForDate, getUpcomingShabbat } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";
import type { HeroEruv, HeroZmanimSnapshot } from "@/components/home/hero/HeroLiveData";
import type { HeroCounts } from "@/components/home/hero/heroNodes";

export interface HeroData {
  zmanim: HeroZmanimSnapshot;
  eruv: HeroEruv | null;
  counts: HeroCounts;
}

/** Toronto values, rendered on the server for every visitor. */
export async function getHeroData(): Promise<HeroData> {
  const today = getZmanimForDate(undefined, TORONTO_LOCATION);
  const upcoming = getUpcomingShabbat(TORONTO_LOCATION);

  const weekFromNow = new Date(Date.now() + 7 * 86_400_000);

  // The zmanim above are computed locally and never touch the database, so a
  // failed query costs the hero only its counts and eruv segment — not the whole
  // page. Every other homepage section already degrades this way; before this the
  // hero was the one raw query that could take the render down with it.
  const loadHeroRows = () =>
    Promise.all([
      db
        .select({ n: count() })
        .from(businesses)
        .where(and(eq(businesses.approvalStatus, "approved"), eq(businesses.isActive, true))),
      db.select({ n: count() }).from(shuls).where(eq(shuls.isActive, true)),
      db
        .select({ n: count() })
        .from(events)
        .where(
          and(
            eq(events.approvalStatus, "approved"),
            eq(events.isActive, true),
            gte(events.startTime, new Date()),
            lte(events.startTime, weekFromNow),
          ),
        ),
      // LATEST row by statusDate, with no staleness cutoff — deliberately the same
      // query /api/community/eruv uses. Admins post a row per update rather than
      // per day, so a `statusDate = today` filter would usually find nothing and the
      // strip would contradict EruvWidget further down the same page.
      db.select().from(eruvStatus).orderBy(desc(eruvStatus.statusDate)).limit(1),
    ]);

  type HeroRows = Awaited<ReturnType<typeof loadHeroRows>>;

  const [businessCount, shulCount, eventCount, eruvRow] = await safeQuery<HeroRows>(
    loadHeroRows,
    // Counts of 0 and no eruv row: the strip drops the eruv segment rather than
    // guessing a status, which is the same thing it does when the table is empty.
    [[], [], [], []],
    { label: "hero" },
  );

  return {
    zmanim: {
      candleLightingISO: today.candleLighting?.toISOString() ?? null,
      havdalahISO: today.havdalah?.toISOString() ?? null,
      upcomingCandleLightingISO: upcoming.candleLighting?.toISOString() ?? null,
      hebrewDateHebrew: today.hebrewDateHebrew,
      parsha: today.parsha ?? upcoming.parsha ?? null,
    },
    // No row at all: the strip omits the eruv segment rather than guessing.
    eruv: eruvRow[0]
      ? { isUp: eruvRow[0].isUp, message: eruvRow[0].message ?? null }
      : null,
    counts: {
      businesses: Number(businessCount[0]?.n ?? 0),
      shuls: Number(shulCount[0]?.n ?? 0),
      events: Number(eventCount[0]?.n ?? 0),
    },
  };
}
