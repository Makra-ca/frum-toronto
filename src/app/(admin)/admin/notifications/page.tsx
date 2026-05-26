"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  FileText,
  ShieldAlert,
  MessageSquare,
  UserCheck,
  HelpCircle,
  Building2,
  Video,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

function getIcon(type: string) {
  switch (type) {
    case "content_submitted":
      return <FileText className="h-5 w-5 text-blue-500" />;
    case "trusted_user_posted":
      return <UserCheck className="h-5 w-5 text-green-500" />;
    case "content_approved":
      return <CheckCheck className="h-5 w-5 text-green-600" />;
    case "content_rejected":
      return <ShieldAlert className="h-5 w-5 text-red-500" />;
    case "comment_posted":
      return <MessageSquare className="h-5 w-5 text-purple-500" />;
    case "question_answered":
      return <HelpCircle className="h-5 w-5 text-orange-500" />;
    case "nonprofit_application":
      return <Building2 className="h-5 w-5 text-teal-500" />;
    case "video_pending":
      return <Video className="h-5 w-5 text-yellow-500" />;
    default:
      return <Bell className="h-5 w-5 text-gray-400" />;
  }
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function groupNotifications(notifications: Notification[]) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (d >= startOfToday) {
      today.push(n);
    } else if (d >= startOfYesterday) {
      yesterday.push(n);
    } else {
      earlier.push(n);
    }
  }

  return { today, yesterday, earlier };
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 20;

  const fetchNotifications = useCallback(async (page: number, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(
        `/api/admin/notifications?page=${page}&limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      if (append) {
        setNotifications((prev) => [...prev, ...(json.data ?? [])]);
      } else {
        setNotifications(json.data ?? []);
      }
      setPagination(json.pagination);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = async () => {
    setMarkingAllRead(true);
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) {
      setMarkingAllRead(false);
      return;
    }
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Silently ignore
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) {
      await markRead(n.id);
    }
    if (n.linkUrl) {
      router.push(n.linkUrl);
    }
  };

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  const { today, yesterday, earlier } = groupNotifications(notifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderGroup = (label: string, items: Notification[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
          {label}
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-4 transition-colors",
                !n.isRead
                  ? "bg-blue-50 border-l-4 border-l-blue-500"
                  : "border-l-4 border-l-transparent hover:bg-gray-50"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm",
                    !n.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                  )}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{getRelativeTime(n.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {n.linkUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleNotificationClick(n)}
                  >
                    View
                  </Button>
                )}
                {!n.isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Notifications are retained for 30 days and then automatically removed.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAllRead}
            className="gap-2"
          >
            {markingAllRead ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {renderGroup("Today", today)}
            {renderGroup("Yesterday", yesterday)}
            {renderGroup("Earlier", earlier)}
          </div>
        )}

        {/* Load more */}
        {pagination?.hasMore && (
          <div className="px-4 py-4 border-t bg-gray-50 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
