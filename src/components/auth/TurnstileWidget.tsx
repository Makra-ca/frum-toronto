"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing at all when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so
 * local development and the existing tests are unaffected — the server side
 * fails open in development for the same reason, and closed in production.
 *
 * The script is loaded here rather than in the root layout: it is needed on one
 * page, and every visitor to every other page should not pay for it.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export function TurnstileWidget({
  onToken,
  onResetRef,
}: {
  onToken: (token: string | null) => void;
  /** Lets the parent clear the token after a failed submit. */
  onResetRef?: (reset: () => void) => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  // The callback is held in a ref so re-rendering the parent (every keystroke
  // in the form) does not tear down and re-render the widget, which would drop
  // a token the visitor has already earned.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;

    if (window.turnstile) {
      setScriptReady(true);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
    // Not removed on unmount: it is shared, and a second mount would otherwise
    // re-download it.
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current) return;
    if (widgetIdRef.current !== null) return;
    if (!window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onTokenRef.current(token),
      // A Turnstile token is single-use and expires after ~5 minutes. Someone
      // filling in a long form can outlast it, so the parent is told the token
      // is gone rather than being left holding a stale one that the server will
      // reject with no explanation.
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
      theme: "light",
    });

    onResetRef?.(() => {
      if (widgetIdRef.current !== null) {
        window.turnstile?.reset(widgetIdRef.current);
        onTokenRef.current(null);
      }
    });

    const widgetId = widgetIdRef.current;
    return () => {
      if (widgetId !== null) {
        window.turnstile?.remove(widgetId);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, scriptReady, onResetRef]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
