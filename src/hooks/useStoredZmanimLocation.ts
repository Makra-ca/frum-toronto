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

  // Hydrate the saved location from localStorage on mount.
  useEffect(() => {
    const stored = parseStoredLocation(
      localStorage.getItem(ZMANIM_LOCATION_STORAGE_KEY)
    );
    if (stored) setLocationState(stored);
  }, []);

  const setLocation = useCallback((loc: ZmanimLocation) => {
    setLocationState(loc);
    if (isTorontoLocation(loc)) {
      localStorage.removeItem(ZMANIM_LOCATION_STORAGE_KEY);
    } else {
      localStorage.setItem(ZMANIM_LOCATION_STORAGE_KEY, serializeLocation(loc));
    }
  }, []);

  return [location, setLocation] as const;
}
