"use client";

import { useEffect } from "react";

interface PageViewOptions {
  entityType?: string;
  entityId?: number | string;
}

export function usePageView(options: PageViewOptions = {}) {
  useEffect(() => {
    // window.location is safe here — runs only in the browser after mount
    fetch("/api/analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.pathname,
        entityType: options.entityType,
        entityId: options.entityId,
      }),
    }).catch(() => {
      // Swallow errors silently — analytics must never break the UI
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
