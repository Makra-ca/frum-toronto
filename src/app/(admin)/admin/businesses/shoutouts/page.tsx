"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
  Send,
  Loader2,
  Megaphone,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Shoutout {
  id: number;
  businessId: number;
  businessName: string | null;
  businessSlug: string | null;
  scheduledDate: string;
  contentHtml: string | null;
  imageUrl: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending_approval: {
      label: "Pending Review",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: <Clock className="h-3 w-3 mr-1" />,
    },
    approved: {
      label: "Approved",
      className: "bg-green-100 text-green-800 border-green-200",
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-100 text-red-800 border-red-200",
      icon: <XCircle className="h-3 w-3 mr-1" />,
    },
    sent: {
      label: "Sent",
      className: "bg-blue-100 text-blue-800 border-blue-200",
      icon: <Send className="h-3 w-3 mr-1" />,
    },
    draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-600 border-gray-200",
      icon: null,
    },
  };

  const config = map[status] || { label: status, className: "bg-gray-100 text-gray-600 border-gray-200", icon: null };

  return (
    <Badge className={`${config.className} inline-flex items-center`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function PendingShoutoutCard({
  shoutout,
  onDecision,
}: {
  shoutout: Shoutout;
  onDecision: (id: number, action: "approve" | "reject", reason?: string) => Promise<void>;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setSubmitting(true);
    try {
      await onDecision(shoutout.id, action, action === "reject" ? rejectionReason : undefined);
    } finally {
      setSubmitting(false);
      setRejectMode(false);
      setRejectionReason("");
    }
  }

  const scheduledFormatted = new Date(shoutout.scheduledDate + "T00:00:00").toLocaleDateString(
    "en-CA",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {shoutout.businessName || "Unknown Business"}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Scheduled for {scheduledFormatted}
            </div>
          </div>
          <StatusBadge status={shoutout.status} />
        </div>

        {/* Content preview */}
        {shoutout.contentHtml && (
          <div
            className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: shoutout.contentHtml }}
          />
        )}

        {/* Image preview */}
        {shoutout.imageUrl && (
          <div className="rounded-md overflow-hidden border">
            <img
              src={shoutout.imageUrl}
              alt="Shoutout image"
              className="w-full max-h-40 object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="pt-1 space-y-3">
          {rejectMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Rejection reason <span className="text-gray-400">(optional)</span>
              </label>
              <Textarea
                placeholder="Explain why the shoutout was not approved..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction("reject")}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Confirm Rejection
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRejectMode(false);
                    setRejectionReason("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction("approve")}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setRejectMode(true)}
                disabled={submitting}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShoutoutsPage() {
  const [pending, setPending] = useState<Shoutout[]>([]);
  const [scheduled, setScheduled] = useState<Shoutout[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledPagination, setScheduledPagination] = useState<Pagination | null>(null);

  async function fetchPending() {
    try {
      const res = await fetch("/api/admin/shoutouts?status=pending_approval&limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setPending(json.data || []);
    } catch {
      toast.error("Failed to load pending shoutouts");
    } finally {
      setLoadingPending(false);
    }
  }

  const fetchScheduled = useCallback(async (page: number) => {
    setLoadingScheduled(true);
    try {
      const res = await fetch(`/api/admin/shoutouts?status=approved&limit=20&page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setScheduled(json.data || []);
      setScheduledPagination(json.pagination || null);
    } catch {
      toast.error("Failed to load approved shoutouts");
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, []);

  useEffect(() => {
    fetchScheduled(scheduledPage);
  }, [fetchScheduled, scheduledPage]);

  async function handleDecision(
    id: number,
    action: "approve" | "reject",
    reason?: string
  ) {
    const res = await fetch(`/api/admin/shoutouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to process shoutout");
    }

    toast.success(action === "approve" ? "Shoutout approved" : "Shoutout rejected");

    if (action === "approve") {
      // Move from pending to scheduled
      const moved = pending.find((s) => s.id === id);
      if (moved) {
        setPending((prev) => prev.filter((s) => s.id !== id));
        setScheduled((prev) =>
          [...prev, { ...moved, status: "approved" }].sort(
            (a, b) => a.scheduledDate.localeCompare(b.scheduledDate)
          )
        );
      }
    } else {
      setPending((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="space-y-10">
      {/* Pending Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Pending Approval</h2>
          {pending.length > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
              {pending.length}
            </span>
          )}
        </div>

        {loadingPending ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-gray-50 border border-dashed rounded-lg py-12 text-center">
            <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No shoutouts pending approval</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((shoutout) => (
              <PendingShoutoutCard
                key={shoutout.id}
                shoutout={shoutout}
                onDecision={handleDecision}
              />
            ))}
          </div>
        )}
      </section>

      {/* Approved / Upcoming Calendar */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Approved Shoutouts Calendar</h2>
        <p className="text-sm text-gray-500 -mt-2">
          Upcoming approved shoutouts ordered by scheduled date.
        </p>

        {loadingScheduled ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : scheduled.length === 0 ? (
          <div className="bg-gray-50 border border-dashed rounded-lg py-12 text-center">
            <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No approved shoutouts scheduled</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
                    Preview
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map((shoutout, idx) => {
                  const dateFormatted = new Date(
                    shoutout.scheduledDate + "T00:00:00"
                  ).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    weekday: "short",
                  });

                  return (
                    <tr
                      key={shoutout.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                        {dateFormatted}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">
                          {shoutout.businessName || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell max-w-xs">
                        <div className="flex items-center gap-2">
                          {shoutout.imageUrl && (
                            <div className="shrink-0 w-8 h-8 rounded overflow-hidden border bg-gray-100">
                              <img
                                src={shoutout.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {shoutout.contentHtml ? (
                            <span
                              className="text-gray-600 text-xs truncate"
                              dangerouslySetInnerHTML={{
                                __html: shoutout.contentHtml.replace(/<[^>]+>/g, " ").trim().slice(0, 80),
                              }}
                            />
                          ) : (
                            <span className="text-gray-400 text-xs italic">No content</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={shoutout.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination for approved list */}
            {scheduledPagination && scheduledPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-gray-500">
                  Page {scheduledPagination.page} of {scheduledPagination.totalPages} &middot;{" "}
                  {scheduledPagination.totalCount} total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduledPage((p) => Math.max(1, p - 1))}
                    disabled={scheduledPage === 1 || loadingScheduled}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduledPage((p) => p + 1)}
                    disabled={!scheduledPagination.hasMore || loadingScheduled}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
