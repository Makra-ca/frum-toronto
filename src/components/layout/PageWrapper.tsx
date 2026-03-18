'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard');
  const [shouldDelayFadeIn, setShouldDelayFadeIn] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Only apply delayed fade-in if preloader hasn't been shown yet this session
    const hasSeenPreloader = sessionStorage.getItem('preloaderShown');
    if (!hasSeenPreloader) {
      setShouldDelayFadeIn(true);
    }
  }, []);

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
