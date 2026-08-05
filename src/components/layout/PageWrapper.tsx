'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  hasSeenPreloader,
  isPreloaderSkippedRoute,
  PRELOADER_TOTAL_MS,
} from '@/components/layout/Preloader';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = isPreloaderSkippedRoute(pathname);
  // Read during the FIRST RENDER, not in an effect.
  //
  // Preloader is a sibling rendered just before this component in LayoutWrapper,
  // so React runs its effect first — and that effect is what stamps the "seen"
  // flag. Anything reading the flag from an effect here therefore always saw
  // "already seen", so `shouldDelayFadeIn` was permanently false and the delayed
  // fade-in never applied. Render runs before any effect, so this sees the value
  // as it was before this visit.
  //
  // The SSR guard is required (no `localStorage` on the server) and is safe: the
  // value is only consumed once `isClient` is true, i.e. from the second render
  // onwards, so it can never cause a hydration mismatch.
  //
  // Note this is a `useState` initializer, not a plain `const`: the flag must be
  // captured once at mount. PageWrapper stays mounted across client-side
  // navigations, and re-reading on a later render would return "seen" and flip
  // the class mid-animation.
  //
  // `isAdminRoute` is part of the condition because Preloader skips those routes
  // WITHOUT stamping the flag. Land on /dashboard first, navigate to a public
  // page, and a flag-only check would hold the page at `opacity: 0` for 3.2s
  // waiting for a preloader that already declined to run.
  const [shouldDelayFadeIn, setShouldDelayFadeIn] = useState(
    () => typeof window !== 'undefined' && !isAdminRoute && !hasSeenPreloader()
  );
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // The delayed variant is a one-shot, synced to the preloader that is on screen
  // right now. Retire it once that preloader is gone: this div unmounts whenever
  // the visitor is on /dashboard and remounts on the way back, and a CSS
  // animation replays on remount — which would mean 3.2s of `opacity: 0` with no
  // preloader behind it.
  useEffect(() => {
    if (!shouldDelayFadeIn) return;
    const timer = setTimeout(() => setShouldDelayFadeIn(false), PRELOADER_TOTAL_MS);
    return () => clearTimeout(timer);
  }, [shouldDelayFadeIn]);

  // Skip fade-in animation on admin/dashboard routes (no preloader there)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Before client hydration, render without animation to avoid flash
  if (!isClient) {
    return <div style={{ opacity: 0 }}>{children}</div>;
  }

  // If preloader was already shown, fade in immediately (no delay)
  // If preloader is showing now, use delayed fade-in to sync with preloader
  return (
    <div className={shouldDelayFadeIn ? 'animate-page-fade-in' : 'animate-page-fade-in-immediate'}>
      {children}
    </div>
  );
}
