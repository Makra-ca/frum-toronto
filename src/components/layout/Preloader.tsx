'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Pre-defined particle positions to avoid hydration mismatch
const particleData = [
  { left: 46, tx: -45, ty: -90 },
  { left: 48, tx: 30, ty: -120 },
  { left: 52, tx: -20, ty: -100 },
  { left: 50, tx: 55, ty: -85 },
  { left: 47, tx: -60, ty: -110 },
  { left: 53, tx: 15, ty: -95 },
  { left: 49, tx: -35, ty: -130 },
  { left: 51, tx: 45, ty: -105 },
  { left: 48, tx: -50, ty: -80 },
  { left: 52, tx: 25, ty: -115 },
  { left: 46, tx: -15, ty: -125 },
  { left: 54, tx: 60, ty: -90 },
  { left: 50, tx: -70, ty: -100 },
  { left: 47, tx: 40, ty: -135 },
  { left: 53, tx: -25, ty: -95 },
  { left: 49, tx: 50, ty: -110 },
];

export default function Preloader() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  // Skip preloader on admin/dashboard routes
  const isAdminRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard');

  useEffect(() => {
    // Don't show preloader on admin/dashboard routes
    if (isAdminRoute) {
      setIsLoading(false);
      return;
    }

    // Start fade out after animation completes
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 3200);

    // Remove preloader after fade
    const removeTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3900);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [isAdminRoute]);

  if (!isLoading || isAdminRoute) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-gradient-to-b from-blue-950 to-slate-950 flex flex-col items-center justify-center transition-opacity duration-700 ease-out ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animation Container */}
      <div className="relative w-64 h-48 mb-8">
        {/* SVG Toronto Skyline + Star of David */}
        <svg
          viewBox="0 0 200 120"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ground line */}
          <path
            d="M10 95 L190 95"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeLinecap="round"
            className="skyline-ground"
          />

          {/* CN Tower - draws first */}
          <g className="cn-tower">
            {/* Tower base/shaft */}
            <path
              d="M100 95 L100 55 L95 55 L95 95"
              stroke="#3b82f6"
              strokeWidth="1.5"
              fill="none"
              className="cn-tower-shaft"
            />
            {/* Tower pod */}
            <path
              d="M88 55 Q88 45 97.5 45 Q107 45 107 55 L88 55"
              stroke="#3b82f6"
              strokeWidth="1.5"
              fill="none"
              className="cn-tower-pod"
            />
            {/* Tower spire */}
            <path
              d="M97.5 45 L97.5 20"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="cn-tower-spire"
            />
            {/* Tower antenna top */}
            <circle cx="97.5" cy="18" r="2" stroke="#3b82f6" strokeWidth="1" fill="none" className="cn-tower-top" />
          </g>

          {/* Left buildings */}
          <g className="buildings-left">
            <path d="M25 95 L25 70 L40 70 L40 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-1" />
            <path d="M45 95 L45 60 L55 60 L55 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-2" />
            <path d="M60 95 L60 75 L75 75 L75 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-3" />
          </g>

          {/* Right buildings */}
          <g className="buildings-right">
            <path d="M120 95 L120 72 L135 72 L135 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-4" />
            <path d="M140 95 L140 65 L155 65 L155 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-5" />
            <path d="M160 95 L160 78 L175 78 L175 95" stroke="#3b82f6" strokeWidth="1" fill="none" className="building-6" />
          </g>

          {/* Star of David - appears after skyline */}
          <g className="star-of-david" transform="translate(97.5, 55)">
            {/* Upper triangle */}
            <path
              d="M0 -22 L19 11 L-19 11 Z"
              stroke="#60a5fa"
              strokeWidth="1.5"
              fill="none"
              className="star-triangle-up"
            />
            {/* Lower triangle */}
            <path
              d="M0 22 L19 -11 L-19 -11 Z"
              stroke="#60a5fa"
              strokeWidth="1.5"
              fill="none"
              className="star-triangle-down"
            />
          </g>
        </svg>

        {/* Glow effect */}
        <div className="preloader-glow absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-blue-500/30 blur-2xl" />

        {/* Particles */}
        <div className="particles absolute inset-0 overflow-visible">
          {particleData.map((particle, i) => (
            <div
              key={i}
              className="particle absolute w-1.5 h-1.5 rounded-full bg-blue-400"
              style={{
                left: `${particle.left}%`,
                top: '40%',
                animationDelay: `${2.0 + (i * 0.04)}s`,
                '--tx': `${particle.tx}px`,
                '--ty': `${particle.ty}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Text */}
      <h1 className="preloader-text text-3xl font-bold text-white tracking-wide">
        <span className="text-blue-300">Frum</span>Toronto
      </h1>
      <p className="preloader-subtext text-blue-300/70 text-sm mt-2">
        Toronto&apos;s Jewish Community Gateway
      </p>
    </div>
  );
}
