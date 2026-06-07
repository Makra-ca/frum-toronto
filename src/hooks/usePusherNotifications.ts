"use client";

import { useEffect, useRef } from "react";
import type Pusher from "pusher-js";

export interface AdminNotificationEvent {
  title: string;
  linkUrl: string;
}

const CHANNEL = "private-admin-notifications";
const EVENT = "new-notification";

/**
 * Subscribes to the private admin notifications channel and invokes the
 * handler on each "new-notification" event.
 *
 * Graceful no-op when NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER are
 * absent (local dev without Pusher) — the app works minus live updates.
 */
export function usePusherNotifications(
  onNotification: (data: AdminNotificationEvent) => void
): void {
  // Keep the latest handler without re-subscribing on every render
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return; // Pusher not configured — no live updates

    let pusher: Pusher | null = null;
    let cancelled = false;

    // Dynamic import keeps pusher-js out of the bundle for non-admin pages
    import("pusher-js")
      .then(({ default: PusherClient }) => {
        if (cancelled) return;

        pusher = new PusherClient(key, {
          cluster,
          channelAuthorization: {
            endpoint: "/api/pusher/auth",
            transport: "ajax",
          },
        });

        const channel = pusher.subscribe(CHANNEL);
        channel.bind(EVENT, (data: AdminNotificationEvent) => {
          handlerRef.current(data);
        });
      })
      .catch((error) => {
        console.error("[PUSHER] Failed to load pusher-js:", error);
      });

    return () => {
      cancelled = true;
      if (pusher) {
        pusher.unsubscribe(CHANNEL);
        pusher.disconnect();
      }
    };
  }, []);
}
