"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, ExternalLink, CalendarPlus } from "lucide-react";
import {
  statusStyle,
  formatSubmissionDetail,
} from "@/lib/submissions/status-display";
import type { Submission } from "@/lib/submissions/list-query";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch("/api/user/submissions")
      .then((res) => (res.ok ? res.json() : { submissions: [] }))
      .then((data) => setSubmissions(data.submissions ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  const pastCount = useMemo(
    () => submissions.filter((s) => s.isPast).length,
    [submissions]
  );
  const visible = useMemo(
    () => (showPast ? submissions : submissions.filter((s) => !s.isPast)),
    [submissions, showPast]
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything you&apos;ve submitted to FrumToronto, and where it stands.
          </p>
        </div>
        <Button asChild>
          <Link href="/community/calendar/new">
            <CalendarPlus className="h-4 w-4 mr-2" />
            Submit an event
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your submissions…
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>You haven&apos;t submitted anything yet.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/community/calendar/new">Submit an event</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((s) => {
              const status = statusStyle(s.approvalStatus);
              const detail = formatSubmissionDetail(s.detail, s.detailKind);
              const rejected = s.approvalStatus === "rejected";

              return (
                <Card key={`${s.type}-${s.id}`} className="overflow-hidden">
                  <div className="flex">
                    {/* State is scannable without reading the labels. */}
                    <div className={`w-1 shrink-0 ${status.stripe}`} />
                    <CardContent className="p-4 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline">{s.typeLabel}</Badge>
                            <Badge className={status.className}>
                              {status.label}
                            </Badge>
                            {s.isPast && (
                              <span className="text-xs text-gray-400">Past</span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900 truncate">
                            {s.title}
                          </p>
                          {detail && (
                            <p className="text-sm text-gray-500">{detail}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {s.publicHref && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={s.publicHref}>
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          )}
                          {s.editHref && (
                            <Button asChild variant="outline" size="sm">
                              <Link href={s.editHref}>
                                <Pencil className="h-4 w-4 mr-1" />
                                {rejected ? "Edit & resubmit" : "Edit"}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>

                      {rejected && (
                        <div className="mt-3 rounded-md bg-red-50 border border-red-100 p-3">
                          <p className="text-sm text-red-900">
                            {s.rejectionReason?.trim()
                              ? s.rejectionReason
                              : "This wasn't approved. Reply to the email we sent and we'll explain what needs changing."}
                          </p>
                        </div>
                      )}

                      {s.approvalStatus === "pending_edit" && (
                        <p className="mt-3 text-sm text-amber-800">
                          Your changes are with an admin. This is off the site
                          until they approve it.
                        </p>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>

          {visible.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                <p>Nothing current — everything you&apos;ve submitted has passed.</p>
              </CardContent>
            </Card>
          )}

          {pastCount > 0 && (
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPast((v) => !v)}
              >
                {showPast
                  ? "Hide past submissions"
                  : `Show past submissions (${pastCount})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
