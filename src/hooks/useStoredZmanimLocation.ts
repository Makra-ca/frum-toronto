"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type ZmanimLocation,
  TORONTO_LOCATION,
  isTorontoLocation,
  parseStoredLocation,
  serializeLocation,
} from "@/lib/zmanim-location";

const ZMANIM_LOCATION_STORAGE_KEY = "ft_zmanim_location";

export function useStoredZmanimLocation() {
  const [location, setLocationState] = useState<ZmanimLocation>(TORONTO_LOCATION);
  // Distinguishes "localStorage not read yet" from "no saved location". Without
  // it, a consumer cannot tell the initial Toronto default from a deliberate
  // Toronto choice, and would compute against Toronto and then visibly correct
  // itself — roughly 21 dial ticks for a saved Jerusalem location.
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate the saved location from localStorage on mount.
  useEffect(() => {
    const stored = parseStoredLocation(
      localStorage.getItem(ZMANIM_LOCATION_STORAGE_KEY)
    );
    if (stored) setLocationState(stored);
    setIsHydrated(true);
  }, []);

  const setLocation = useCallback((loc: ZmanimLocation) => {
    setLocationState(loc);
    if (isTorontoLocation(loc)) {
      localStorage.removeItem(ZMANIM_LOCATION_STORAGE_KEY);
    } else {
      localStorage.setItem(ZMANIM_LOCATION_STORAGE_KEY, serializeLocation(loc));
    }
  }, []);

  // Third element is additive: existing consumers destructure two and are
  // unaffected.
  return [location, setLocation, isHydrated] as const;
}
