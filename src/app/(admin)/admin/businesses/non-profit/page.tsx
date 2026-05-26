"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, FileText, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NonProfitApplication {
  id: number;
  name: string;
  slug: string;
  nonProfitDocumentUrl: string | null;
  nonProfitStatus: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" />
        Pending Review
      </Badge>
    );
  }
  if (status === "verified") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function ApplicationCard({
  application,
  onDecision,
}: {
  application: NonProfitApplication;
  onDecision: (id: number, action: "approve" | "reject", reason?: string) => Promise<void>;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setSubmitting(true);
    try {
      await onDecision(
        application.id,
        action,
        action === "reject" ? rejectionReason : undefined
      );
    } finally {
      setSubmitting(false);
      setRejectMode(false);
      setRejectionReason("");
    }
  }

  const isPending = application.nonProfitStatus === "pending";
  const submittedDate = new Date(application.createdAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white border rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg truncate">{application.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">Applied {submittedDate}</p>
        </div>
        <StatusBadge status={application.nonProfitStatus} />
      </div>

      {application.nonProfitDocumentUrl ? (
        <a
          href={application.nonProfitDocumentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >
          <FileText className="h-4 w-4" />
          View Supporting Document
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-sm text-gray-400 italic">No document uploaded</p>
      )}

      {isPending && (
        <div className="pt-1 space-y-3">
          {rejectMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Rejection reason <span className="text-gray-400">(optional)</span>
              </label>
              <Textarea
                placeholder="Explain why the application was not approved..."
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
      )}
    </div>
  );
}

export default function NonProfitApplicationsPage() {
  const [applications, setApplications] = useState<NonProfitApplication[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchApplications() {
    try {
      const res = await fetch("/api/admin/businesses/non-profit-applications");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setApplications(json.data || []);
    } catch {
      toast.error("Failed to load non-profit applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApplications();
  }, []);

  async function handleDecision(
    id: number,
    action: "approve" | "reject",
    reason?: string
  ) {
    try {
      const res = await fetch(`/api/admin/businesses/${id}/non-profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      toast.success(action === "approve" ? "Non-profit status approved" : "Application rejected");
      // Refresh list — optimistically update status in UI
      setApplications((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, nonProfitStatus: action === "approve" ? "verified" : "rejected" }
            : a
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process application");
    }
  }

  const pending = applications.filter((a) => a.nonProfitStatus === "pending");
  const decided = applications.filter((a) => a.nonProfitStatus !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending Applications */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Pending Review
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
                {pending.length}
              </span>
            )}
          </h2>
        </div>

        {pending.length === 0 ? (
          <div className="bg-gray-50 border border-dashed rounded-lg py-12 text-center">
            <CheckCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No pending non-profit applications</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onDecision={handleDecision}
              />
            ))}
          </div>
        )}
      </section>

      {/* Previously Decided */}
      {decided.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 text-gray-500">
            Previously Reviewed
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {decided.map((app) => (
              <div
                key={app.id}
                className="bg-white border rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{app.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(app.createdAt).toLocaleDateString("en-CA")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.nonProfitDocumentUrl && (
                    <a
                      href={app.nonProfitDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                      title="View document"
                    >
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                  <StatusBadge status={app.nonProfitStatus} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
