"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MessageSquare,
  ArrowLeft,
  Check,
  X,
  Lock,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AtrQuickPost } from "@/components/ask-the-rabbi/AtrQuickPost";
import { formatInstant } from "@/lib/datetime";
import { QuestionsLibrary } from "@/components/ask-the-rabbi/manage/QuestionsLibrary";
import type { Pagination } from "@/components/ask-the-rabbi/manage/types";

interface PendingComment {
  id: number;
  questionId: number;
  content: string;
  approvalStatus: string;
  createdAt: string;
  questionTitle: string | null;
  authorName: string;
}

// Types, the edit dialog and the questions library now live in
// src/components/ask-the-rabbi/manage/ so the admin panel can render the
// same screens. See docs/superpowers/specs/2026-08-03-ask-the-rabbi-*.


// ─── Pending Comments Tab ─────────────────────────────────────────────────────

function PendingCommentsTab() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: "pending",
        page: String(page),
        limit: "20",
      });
      const res = await fetch(`/api/admin/ask-the-rabbi/comments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setComments(data.comments || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error("Failed to load pending comments");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleApprove = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi/comments/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve");
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast.success("Comment approved");
    } catch {
      toast.error("Failed to approve comment");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "rejected" }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast.success("Comment rejected");
    } catch {
      toast.error("Failed to reject comment");
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Check className="h-10 w-10 mx-auto text-green-300 mb-3" />
        No pending comments. All caught up!
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {comments.map((comment) => (
          <Card key={comment.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">
                      {comment.authorName}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {formatInstant(comment.createdAt, { month: "numeric", day: "numeric", year: "numeric" })}
                    </span>
                    {comment.questionTitle && (
                      <span className="text-xs text-gray-500">
                        on{" "}
                        <Link
                          href={`/ask-the-rabbi/${comment.questionId}`}
                          target="_blank"
                          className="text-purple-600 hover:underline"
                        >
                          {comment.questionTitle}
                        </Link>
                      </span>
                    )}
                  </div>
                  {/* Comment text */}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                    {comment.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                    onClick={() => handleApprove(comment.id)}
                    disabled={actingId === comment.id}
                  >
                    {actingId === comment.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"
                    onClick={() => handleReject(comment.id)}
                    disabled={actingId === comment.id}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <span className="text-sm text-gray-500">
            {pagination.totalCount} pending — page {pagination.page} of{" "}
            {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "questions" | "comments" | "new";

export default function AskTheRabbiDashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [canManage, setCanManage] = useState<boolean | null>(null);

  // Check permission via a lightweight API call
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/admin/ask-the-rabbi?page=1&limit=1")
      .then((res) => {
        setCanManage(res.ok);
      })
      .catch(() => setCanManage(false));
  }, [status]);

  if (status === "loading" || canManage === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="py-12 text-center">
            <Lock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-4">You must be logged in.</p>
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <Card>
            <CardContent className="py-16 text-center">
              <Lock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Access Restricted
              </h2>
              <p className="text-gray-500 max-w-sm mx-auto">
                You don&apos;t have access to this section. Contact an admin to
                request the Ask the Rabbi management permission.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-12 px-4">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>Ask the Rabbi — Management</CardTitle>
                <CardDescription className="mt-0.5">
                  Manage published Q&amp;As and moderate community comments
                </CardDescription>
              </div>
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 mt-4 border-b">
              {(
                [
                  { key: "questions", label: "All Questions" },
                  { key: "comments", label: "Pending Comments" },
                  { key: "new", label: "New Question", icon: PlusCircle },
                ] as { key: Tab; label: string; icon?: React.ElementType }[]
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === key
                      ? "border-purple-600 text-purple-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {activeTab === "questions" ? (
              <QuestionsLibrary />
            ) : activeTab === "comments" ? (
              <PendingCommentsTab />
            ) : (
              <AtrQuickPost canManageAtr={true} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
