"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, ExternalLink, CalendarPlus } from "lucide-react";
import { formatInstant } from "@/lib/datetime";
import type { Submission } from "@/app/api/user/submissions/route";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Live",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  pending: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  rejected: {
    label: "Not approved",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/submissions")
      .then((res) => (res.ok ? res.json() : { submissions: [] }))
      .then((data) => setSubmissions(data.submissions ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything you&apos;ve submitted to the community calendar.
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
        <div className="space-y-3">
          {submissions.map((s) => {
            const status = STATUS_STYLES[s.approvalStatus] ?? {
              label: s.approvalStatus,
              className: "bg-gray-100 text-gray-700",
            };
            return (
              <Card key={`${s.type}-${s.id}`}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{s.typeLabel}</Badge>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                    <p className="font-medium text-gray-900 truncate">
                      {s.title}
                    </p>
                    {s.detail && (
                      <p className="text-sm text-gray-500">
                        {formatInstant(s.detail, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
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
                          Edit
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
