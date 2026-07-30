"use client";

import { useEffect, useRef } from "react";
import { X, ExternalLink, ArrowRight } from "lucide-react";
import { resolveAdHref } from "@/lib/ads/live-ads";
import { lockBodyScroll } from "@/lib/scroll-lock";
import type { LiveAd } from "@/lib/ads/queries";

interface AdLightboxProps {
  ad: LiveAd;
  onClose: () => void;
}

/**
 * The full flyer, at its natural aspect ratio, with one button to the destination.
 *
 * This is what makes letterboxing acceptable in the slots. A flyer gets roughly
 * five seconds in a short, wide strip — nobody reads the small print there. So
 * the slot only has to be recognisable enough to earn a click, and this does the
 * actual reading.
 */
export function AdLightbox({ ad, onClose }: AdLightboxProps) {
  const target = resolveAdHref(ad);
  const closeRef = useRef<HTMLButtonElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  // Kept in a ref so the close/restore effect does not depend on `onClose`,
  // which is an inline arrow at both call sites and so changes identity on every
  // parent render — re-running the effect would yank focus back to Close and
  // churn the scroll lock.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Remember where focus came from, so it can be handed back on close.
    // Without this a keyboard user is dumped on <body> and has to traverse the
    // whole page again to get back to the ad they were reading.
    const trigger = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      // Focus trap. Without one, Tab walks out of an aria-modal dialog into the
      // page behind it — which is how a second lightbox could be opened while
      // this one was still up.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const releaseScroll = lockBodyScroll();
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      releaseScroll();
      // Only take focus back if it is still inside the dialog — otherwise the
      // user has already moved on and stealing it would be worse than leaving it.
      if (trigger?.isConnected && panelRef.current?.contains(document.activeElement)) {
        trigger.focus();
      }
    };
    // Deliberately empty: this must run once per mount. See onCloseRef above.
  }, []);

  function recordClick() {
    // sendBeacon is fire-and-forget, so counting never delays the navigation.
    // Guarded because it is absent in older browsers and in some webviews.
    try {
      navigator.sendBeacon?.(`/api/ads/${ad.id}/click`);
    } catch {
      // A lost click count is not worth interrupting anyone's navigation.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ad.title}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        // Clicks inside the panel must not reach the backdrop's close handler.
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
          {/*
            Deliberately not next/image: an advertiser's flyer has no known
            dimensions, and `object-contain` at natural ratio is the whole point
            of the overlay. eslint's LCP warning does not apply — this is behind
            a click, so it is never the largest contentful paint.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 border-t bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-900">{ad.title}</p>

          {/*
            No button when the ad points nowhere — resolveAdHref returns null for
            link_type 'none', which is a real case: a flyer carrying a phone
            number needs no click-through.
          */}
          {target && (
            <a
              href={target.href}
              onClick={recordClick}
              {...(target.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {target.external ? (
                <>
                  Visit website
                  <ExternalLink className="h-4 w-4" />
                </>
              ) : (
                <>
                  {ad.businessName ? `View ${ad.businessName}` : "View listing"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
