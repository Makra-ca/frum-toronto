"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationBellProps {
  href: string;
  apiEndpoint: string; // e.g. '/api/admin/notifications'
}

export function NotificationBell({ href, apiEndpoint }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      // Fetch enough to count unread (most admins won't have > 200 unread)
      const res = await fetch(`${apiEndpoint}?limit=200&page=1`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      const count = (json.data ?? []).filter(
        (n: { isRead: boolean }) => !n.isRead
      ).length;
      setUnreadCount(count);
    } catch {
      // Silently ignore errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint]);

  const displayCount = unreadCount > 9 ? "9+" : unreadCount;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      onClick={() => router.push(href)}
      title="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {displayCount}
        </span>
      )}
    </Button>
  );
}
