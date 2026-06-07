"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminNotifications } from "@/components/notifications/AdminNotificationsProvider";

interface NotificationBellProps {
  href: string;
}

// Unread count comes from the shared AdminNotificationsProvider (one fetch on
// mount + one Pusher subscription) — no polling.
export function NotificationBell({ href }: NotificationBellProps) {
  const router = useRouter();
  const { unreadCount } = useAdminNotifications();

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
