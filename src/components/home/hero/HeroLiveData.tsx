"use client";

// src/components/home/hero/HeroLiveData.tsx
//
// Owns the resolved zmanim location and everything derived from it, and hands it
// to the strip and the dial through context.
//
// Why a context provider rather than a wrapper that passes props: the strip is
// full-width above the hero body while the dial sits inside the right column, so
// they are not siblings. A prop-passing wrapper would have to own the two-column
// layout and take the server-rendered left column through a slot — moving an
// ownership problem into a layout problem. This renders {children} and imposes no
// layout at all.
//
// Two separate readiness flags, because the ring and the times depend on
// different things:
//
//   isHydrated       localStorage has been read. The dial needs only a tzid, so
//                    its tick ring gates on this and never waits for a network
//                    request it does not need.
//   isTimesResolved  hydrated AND (Toronto OR the fetch has settled). A FAILED
//                    fetch counts as settled — otherwise a visitor with a saved
//                    non-Toronto location on a flaky connection would be stuck
//                    in a loading state forever.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStoredZmanimLocation } from "@/hooks/useStoredZmanimLocation";
import {
  isTorontoLocation,
  buildZmanimParams,
  type ZmanimLocation,
} from "@/lib/zmanim-location";
import { resolvePrimaryZman, type PrimaryZman } from "@/lib/hero/primaryZman";
import type { HeroCounts } from "./heroNodes";

export interface HeroEruv {
  isUp: boolean;
  message: string | null;
}

/** Serialisable zmanim the server renders for Toronto. */
export interface HeroZmanimSnapshot {
  candleLightingISO: string | null;
  havdalahISO: string | null;
  upcomingCandleLightingISO: string | null;
  hebrewDateHebrew: string;
  parsha: string | null;
}

interface HeroLiveValue {
  location: ZmanimLocation;
  isHydrated: boolean;
  isTimesResolved: boolean;
  primaryZman: PrimaryZman | null;
  hebrewDateHebrew: string;
  parsha: string | null;
  /** Toronto-only concept: hidden for any other location. */
  eruv: HeroEruv | null;
  counts: HeroCounts;
}

const HeroLiveContext = createContext<HeroLiveValue | null>(null);

export function useHeroLive(): HeroLiveValue {
  const ctx = useContext(HeroLiveContext);
  if (!ctx) throw new Error("useHeroLive must be used inside <HeroLiveData>");
  return ctx;
}

const toDate = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

interface HeroLiveDataProps {
  /** Server-rendered Toronto values; the initial state for every visitor. */
  zmanim: HeroZmanimSnapshot;
  eruv: HeroEruv | null;
  counts: HeroCounts;
  children: ReactNode;
}

export function HeroLiveData({ zmanim, eruv, counts, children }: HeroLiveDataProps) {
  const [location, , isHydrated] = useStoredZmanimLocation();
  const [snapshot, setSnapshot] = useState<HeroZmanimSnapshot>(zmanim);
  const [fetchSettled, setFetchSettled] = useState(false);

  const isToronto = isTorontoLocation(location);

  useEffect(() => {
    if (!isHydrated) return;

    // Toronto is already server-rendered: no request, no re-render of times.
    if (isToronto) {
      setSnapshot(zmanim);
      setFetchSettled(true);
      return;
    }

    let active = true;
    setFetchSettled(false);

    fetch(`/api/zmanim?${buildZmanimParams(location).toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`zmanim ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSnapshot({
          candleLightingISO: data.candleLightingISO ?? null,
          havdalahISO: data.havdalahISO ?? null,
          upcomingCandleLightingISO: data.upcomingCandleLightingISO ?? null,
          hebrewDateHebrew: data.hebrewDateHebrew ?? zmanim.hebrewDateHebrew,
          // Fall through to the coming Shabbos's parsha on a weekday, matching
          // what the server does for Toronto. Without this the parsha silently
          // disappeared from the strip when a non-Toronto location was chosen.
          parsha: data.parsha ?? data.upcomingParsha ?? null,
        });
      })
      .catch((err) => {
        // Keep the server-rendered Toronto values rather than blanking the hero.
        console.error("[HERO] zmanim fetch failed; keeping Toronto values", err);
      })
      .finally(() => {
        // Settled either way — see the note at the top of this file.
        if (active) setFetchSettled(true);
      });

    return () => {
      active = false;
    };
  }, [isHydrated, isToronto, location, zmanim]);

  const value = useMemo<HeroLiveValue>(() => {
    const primaryZman = resolvePrimaryZman({
      candleLighting: toDate(snapshot.candleLightingISO),
      havdalah: toDate(snapshot.havdalahISO),
      upcomingCandleLighting: toDate(snapshot.upcomingCandleLightingISO),
    });

    return {
      location,
      isHydrated,
      isTimesResolved: isHydrated && (isToronto || fetchSettled),
      primaryZman,
      hebrewDateHebrew: snapshot.hebrewDateHebrew,
      parsha: snapshot.parsha,
      eruv: isToronto ? eruv : null,
      counts,
    };
  }, [location, isHydrated, isToronto, fetchSettled, snapshot, eruv, counts]);

  return <HeroLiveContext.Provider value={value}>{children}</HeroLiveContext.Provider>;
}
