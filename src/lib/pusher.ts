import Pusher from "pusher";

/** Single shared private channel for admin notifications (private- prefix is mandatory). */
export const ADMIN_NOTIFICATIONS_CHANNEL = "private-admin-notifications";
export const NEW_NOTIFICATION_EVENT = "new-notification";

// undefined = not yet initialized, null = env vars absent (disabled)
let client: Pusher | null | undefined;

/**
 * Lazy server-side Pusher client.
 * Returns null when env vars are absent (local dev) — callers must no-op.
 */
export function getPusherServer(): Pusher | null {
  if (client !== undefined) return client;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.warn("[PUSHER] Env vars not configured — real-time notifications disabled");
    client = null;
    return null;
  }

  client = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return client;
}
