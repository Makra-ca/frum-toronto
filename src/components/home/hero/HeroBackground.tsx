"use client";

// src/components/home/hero/HeroBackground.tsx
//
// The gate in front of the WebGL background. LightRays must never be imported
// anywhere else.
//
// Layer 1 (always): a navy gradient plus an SVG turbulence grain. The grain is
// not decoration — large dark-blue gradients band visibly on cheap displays, and
// noise is the standard fix. This layer is also the permanent fallback, so a
// refused or failed WebGL context degrades to something finished-looking rather
// than to nothing.
//
// Layer 2 (conditional): LightRays, mounted ONLY when
//   - the viewport is at least `md`, and
//   - the visitor has not asked for reduced motion.
// Both are evaluated after mount, so no WebGL work happens on a phone at all.
// A canvas that renders every frame forever is real battery cost on the site's
// busiest page.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LightRays = dynamic(() => import("./LightRays").then((m) => m.default ?? m), {
  ssr: false,
});

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>\")";

export function HeroBackground() {
  const [enableWebGL, setEnableWebGL] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");

    const evaluate = () => setEnableWebGL(wide.matches && !motion.matches);
    evaluate();

    motion.addEventListener("change", evaluate);
    wide.addEventListener("change", evaluate);
    return () => {
      motion.removeEventListener("change", evaluate);
      wide.removeEventListener("change", evaluate);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Always-on base: gradient + grain. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1c3d] via-[#0f2f5e] to-[#08142a]" />
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {enableWebGL && (
        <div className="absolute inset-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#7dd3fc"
            raysSpeed={0.7}
            lightSpread={1.1}
            rayLength={1.5}
            fadeDistance={1.4}
            saturation={0.7}
            followMouse={false}
            noiseAmount={0.08}
            distortion={0.02}
          />
        </div>
      )}

      {/* Vignette, so the ring and the headline sit on a darker field. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent_42%,rgba(4,10,24,0.78)_100%)]" />
    </div>
  );
}
