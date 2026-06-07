"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { usePusherNotifications } from "@/hooks/usePusherNotifications";

interface AdminNotificationsContextValue {
  unreadCount: number;
  refresh: () => void;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

/**
 * Single shared unread-count source for the admin UI (sidebar badge + header
 * bell): ONE fetch on mount + ONE Pusher subscription. No polling.
 */
export function AdminNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications/unread-count", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      setUnreadCount(json.count ?? 0);
    } catch {
      // Silently ignore — count refreshes on next page load
    }
  }, []);

  // One fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-sync when leaving the notifications page (items get marked read there)
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev === "/admin/notifications" && pathname !== "/admin/notifications") {
      refresh();
    }
  }, [pathname, refresh]);

  // One Pusher subscription — increment locally on each event
  usePusherNotifications(() => {
    setUnreadCount((count) => count + 1);
  });

  return (
    <AdminNotificationsContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications(): AdminNotificationsContextValue {
  return useContext(AdminNotificationsContext);
}
