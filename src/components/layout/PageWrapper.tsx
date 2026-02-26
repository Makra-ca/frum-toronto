'use client';

import { usePathname } from 'next/navigation';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard');

  // Skip fade-in animation on admin/dashboard routes (no preloader there)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="animate-page-fade-in">
      {children}
    </div>
  );
}
