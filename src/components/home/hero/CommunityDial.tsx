"use client";

// src/components/home/hero/CommunityDial.tsx
//
// The dial: a tick-marked ring carrying eight navigation discs, with the primary
// zman in the hub.
//
// All geometry comes from src/lib/hero/dial.ts, which is pure and unit-tested;
// this file only turns those numbers into DOM and manages motion.
//
// Motion rules, all deliberate:
//   - 0.5 deg/sec, one lap in 12 minutes. The old hero ran at 3 deg/sec.
//   - Rotation PAUSES while a pointer is inside the dial or focus is within it.
//     Chasing a moving link is a WCAG 2.2.2 failure and a motor-accessibility
//     problem; this makes the target stationary exactly when someone reaches for
//     it.
//   - `prefers-reduced-motion: reduce` never starts the loop at all: one static
//     frame is painted.
//   - Positions are written straight to style.transform in the RAF loop rather
//     than through React state, so a 60fps animation causes zero re-renders. This
//     pattern is inherited from the previous implementation, which got it right.
//
// Elapsed ticks gate on `isHydrated`, NOT on the times fetch: the tick boundary
// needs only a tzid from localStorage. Gating it on the network would strand the
// ring whenever a request failed.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  getNodePosition,
  getTickMarks,
  minutesElapsedInDay,
} from "@/lib/hero/dial";
import { formatZman } from "@/lib/zmanim-format";
import { HERO_NODES, nodeDetail } from "./heroNodes";
import { useHeroLive } from "./HeroLiveData";

const DEG_PER_MS = 0.5 / 1000; // one lap per 12 minutes
const NODE_RADIUS_PCT = 38;
const VIEWBOX = 400;
const RING_RADIUS = 158;
const TICK_REFRESH_MS = 60_000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function CommunityDial() {
  const { primaryZman, location, counts, isHydrated } = useHeroLive();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [minutesElapsed, setMinutesElapsed] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeEls = useRef<(HTMLAnchorElement | null)[]>(HERO_NODES.map(() => null));
  const angleRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const pausedRef = useRef(false);

  // Elapsed ticks: only once the stored location is known, then every minute.
  // Until then every tick renders as upcoming, which is also what the server
  // renders — so there is no hydration mismatch and no visible correction.
  useEffect(() => {
    if (!isHydrated) return;

    const read = () => setMinutesElapsed(minutesElapsedInDay(new Date(), location.tzid));
    read();
    const id = window.setInterval(read, TICK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [isHydrated, location.tzid]);

  const ticks = useMemo(
    () => getTickMarks(VIEWBOX, RING_RADIUS, minutesElapsed ?? 0),
    [minutesElapsed],
  );

  // Orbit. Anchored at the container centre and moved with transforms so the
  // motion is GPU-composited and React never re-renders for it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let size = { w: container.offsetWidth, h: container.offsetHeight };
    const measure = () => {
      size = { w: container.offsetWidth, h: container.offsetHeight };
    };
    const ro = new ResizeObserver(() => {
      measure();
      // The dial is hidden below `md` with `hidden md:block`, which is
      // display:none — so it stays mounted and offsetWidth reports 0. Without
      // this gate the RAF loop would run at 60fps on every phone, painting
      // transforms onto invisible elements. Start and stop the loop with actual
      // visibility instead.
      if (size.w > 0) start();
      else stop();
    });
    ro.observe(container);

    const paint = (angle: number) => {
      HERO_NODES.forEach((_, i) => {
        const el = nodeEls.current[i];
        if (!el) return;
        const { x, y } = getNodePosition(i, HERO_NODES.length, angle, NODE_RADIUS_PCT);
        const offX = ((x - 50) / 100) * size.w;
        const offY = ((y - 50) / 100) * size.h;

        // Re-anchor to the container centre every frame. The JSX sets left/top to
        // a percentage so the nodes are positioned before hydration, and a React
        // re-render restores those values — if we only wrote `transform`, the
        // pixel offset would stack on top of the percentage and push every node
        // to roughly double its radius, out of the ring entirely.
        el.style.left = "50%";
        el.style.top = "50%";
        el.style.transform = `translate(-50%, -50%) translate(${offX}px, ${offY}px)`;
      });
    };

    const step = (timestamp: number) => {
      if (lastTimeRef.current > 0 && !pausedRef.current) {
        angleRef.current =
          (angleRef.current + (timestamp - lastTimeRef.current) * DEG_PER_MS) % 360;
      }
      lastTimeRef.current = timestamp;
      paint(angleRef.current);
      rafRef.current = requestAnimationFrame(step);
    };

    const start = () => {
      // Reduced motion: paint one static frame and never start the loop.
      if (prefersReducedMotion || rafRef.current !== 0) return;
      rafRef.current = requestAnimationFrame(step);
    };

    const stop = () => {
      if (rafRef.current === 0) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      lastTimeRef.current = 0;
    };

    paint(angleRef.current);
    if (size.w > 0) start();

    return () => {
      stop();
      ro.disconnect();
    };
  }, [prefersReducedMotion]);

  const hovered = HERO_NODES.find((n) => n.id === hoveredId) ?? null;

  const hubPrimary = hovered
    ? hovered.label
    : primaryZman
      ? formatZman(primaryZman.time, location.tzid, primaryZman.direction)
      : null;
  const hubSecondary = hovered
    ? nodeDetail(hovered, counts)
    : (primaryZman?.label ?? null);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-[300px] md:w-[360px] lg:w-[420px] xl:w-[460px]"
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
        setHoveredId(null);
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
    >
      {/* Tick ring. Decorative: the destinations below carry the meaning. */}
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(125,211,252,0.16)"
          strokeWidth="1"
        />
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RING_RADIUS - 8}
          fill="none"
          stroke="rgba(125,211,252,0.07)"
          strokeWidth="1"
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="#7dd3fc"
            strokeWidth={i % 6 === 0 ? 1.4 : 1}
            opacity={t.elapsed ? 0.18 : 0.6}
          />
        ))}
      </svg>

      {/* Hub */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-[54%] -translate-x-1/2 -translate-y-1/2 text-center">
        {hubPrimary ? (
          <>
            <div className="font-display text-xl font-bold leading-tight text-white lg:text-2xl">
              {hubPrimary}
            </div>
            {hubSecondary && (
              <div className="mt-1 text-[11px] uppercase tracking-[0.09em] text-slate-300">
                {hubSecondary}
              </div>
            )}
          </>
        ) : (
          // No zman available at all: the wordmark, never a placeholder time.
          <div className="font-display text-lg font-bold text-white">
            Frum<span className="text-sky-300">Toronto</span>
          </div>
        )}
      </div>

      {/* Destinations */}
      {HERO_NODES.map((node, i) => {
        const Icon = node.icon;
        const initial = getNodePosition(i, HERO_NODES.length, 0, NODE_RADIUS_PCT);

        return (
          <Link
            key={node.id}
            href={node.href}
            ref={(el) => {
              nodeEls.current[i] = el;
            }}
            aria-label={`${node.label} — ${nodeDetail(node, counts)}`}
            onPointerEnter={() => setHoveredId(node.id)}
            onFocus={() => setHoveredId(node.id)}
            className="group absolute flex flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            style={{
              left: `${initial.x}%`,
              top: `${initial.y}%`,
              transform: "translate(-50%, -50%)",
              willChange: "transform",
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-300/40 bg-[#091830]/90 transition-colors duration-200 group-hover:border-sky-300 group-hover:bg-blue-700/40">
              <Icon className="h-[17px] w-[17px] text-sky-200 transition-colors duration-200 group-hover:text-white" />
            </span>
            <span className="whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-200 transition-colors duration-200 group-hover:text-white">
              {node.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
