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

/**
 * Broadcast channel for same-document consumers.
 *
 * Each call of this hook owns its own React state and reads localStorage once, on
 * mount. That was fine while the homepage had a single consumer, but the hero and
 * the ZmanimWidget now both read the location on the same page: changing it in one
 * left the other showing stale times until a full reload.
 *
 * The native `storage` event does NOT solve this — it only fires in *other*
 * documents, never the one that performed the write. So `setLocation` dispatches
 * this custom event too, and every instance listens to both:
 *   - this event  -> same tab
 *   - `storage`   -> other tabs
 */
const LOCATION_CHANGED_EVENT = "ft:zmanim-location-changed";

export function useStoredZmanimLocation() {
  const [location, setLocationState] = useState<ZmanimLocation>(TORONTO_LOCATION);
  // Distinguishes "localStorage not read yet" from "no saved location". Without
  // it, a consumer cannot tell the initial Toronto default from a deliberate
  // Toronto choice, and would compute against Toronto and then visibly correct
  // itself — roughly 21 dial ticks for a saved Jerusalem location.
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate the saved location from localStorage on mount, then stay in sync with
  // any other consumer that changes it.
  useEffect(() => {
    const read = () => {
      const stored = parseStoredLocation(
        localStorage.getItem(ZMANIM_LOCATION_STORAGE_KEY)
      );
      // No entry means Toronto: the key is removed rather than written when the
      // user picks Toronto, so falling back to the default is correct here.
      setLocationState(stored ?? TORONTO_LOCATION);
    };

    read();
    setIsHydrated(true);

    const onLocalChange = () => read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === ZMANIM_LOCATION_STORAGE_KEY) read();
    };

    window.addEventListener(LOCATION_CHANGED_EVENT, onLocalChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOCATION_CHANGED_EVENT, onLocalChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLocation = useCallback((loc: ZmanimLocation) => {
    setLocationState(loc);
    if (isTorontoLocation(loc)) {
      localStorage.removeItem(ZMANIM_LOCATION_STORAGE_KEY);
    } else {
      localStorage.setItem(ZMANIM_LOCATION_STORAGE_KEY, serializeLocation(loc));
    }
    // Tell every other consumer in this document. Without this, the hero and the
    // widget disagree until the next full page load.
    window.dispatchEvent(new Event(LOCATION_CHANGED_EVENT));
  }, []);

  // Third element is additive: existing consumers destructure two and are
  // unaffected.
  return [location, setLocation, isHydrated] as const;
}
