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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  MessageSquare,
  ArrowLeft,
  Eye,
  Pencil,
  Check,
  X,
  ExternalLink,
  Lock,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { UniversalSearch } from "@/components/search/UniversalSearch";
import { AtrQuickPost } from "@/components/ask-the-rabbi/AtrQuickPost";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: number;
  questionNumber: number | null;
  title: string;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number | null;
  commentCount: number;
}

interface PendingComment {
  id: number;
  questionId: number;
  content: string;
  approvalStatus: string;
  createdAt: string;
  questionTitle: string | null;
  authorName: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PublishedBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-green-100 text-green-800 font-normal">Published</Badge>
  ) : (
    <Badge className="bg-gray-100 text-gray-600 font-normal">Draft</Badge>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  question: Question | null;
  onClose: () => void;
  onSaved: (updated: Question) => void;
}

function EditDialog({ question, onClose, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(question?.title || "");
  const [questionText, setQuestionText] = useState(question?.question || "");
  const [answer, setAnswer] = useState(question?.answer || "");
  const [answeredBy, setAnsweredBy] = useState(question?.answeredBy || "");
  const [publishedAt, setPublishedAt] = useState(
    question?.publishedAt ? question.publishedAt.slice(0, 10) : ""
  );
  const [isPublished, setIsPublished] = useState(question?.isPublished ?? false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setTitle(question.title);
      setQuestionText(question.question);
      setAnswer(question.answer || "");
      setAnsweredBy(question.answeredBy || "");
      setPublishedAt(question.publishedAt ? question.publishedAt.slice(0, 10) : "");
      setIsPublished(question.isPublished);
    }
  }, [question]);

  const handleSave = async () => {
    if (!question) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi?id=${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          question: questionText.trim(),
          answer: answer.trim() || null,
          answeredBy: answeredBy.trim() || null,
          isPublished,
          publishedAt: publishedAt || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      toast.success("Question updated");
      onSaved({ ...question, ...data });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!question} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-question">Question</Label>
            <Textarea
              id="edit-question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-answer">Answer</Label>
            <Textarea
              id="edit-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              className="resize-y"
              placeholder="Enter the Rabbi's answer..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-answered-by">Answered By</Label>
            <Input
              id="edit-answered-by"
              value={answeredBy}
              onChange={(e) => setAnsweredBy(e.target.value)}
              placeholder="Hagaon Rav Shlomo Miller Shlit'a"
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <Label htmlFor="edit-published-at">Published At</Label>
              <Input
                id="edit-published-at"
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <input
                id="edit-is-published"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-is-published" className="cursor-pointer">
                Published (visible to public)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── All Questions Tab ────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/ask-the-rabbi?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setQuestions(data.questions || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleTogglePublish = async (q: Question) => {
    setTogglingId(q.id);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi?id=${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !q.isPublished }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setQuestions((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, ...updated } : item))
      );
      toast.success(updated.isPublished ? "Question published" : "Question unpublished");
    } catch {
      toast.error("Failed to update publish status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaved = (updated: Question) => {
    setQuestions((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
  };

  return (
    <>
      <EditDialog
        question={editQuestion}
        onClose={() => setEditQuestion(null)}
        onSaved={handleSaved}
      />

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="max-w-sm w-full">
          <UniversalSearch
            searchType="ask-the-rabbi"
            placeholder="Search questions..."
            onSearch={(q) => {
              setSearchInput(q);
              setSearch(q);
              setPage(1);
            }}
          />
        </div>
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <MessageSquare className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          No questions found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium w-12">#</th>
                  <th className="pb-3 pr-4 font-medium">Title</th>
                  <th className="pb-3 pr-4 font-medium w-28">Status</th>
                  <th className="pb-3 pr-4 font-medium w-32">Published</th>
                  <th className="pb-3 pr-4 font-medium w-16 text-center">Comments</th>
                  <th className="pb-3 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50/60">
                    <td className="py-3 pr-4 text-gray-400">
                      {q.questionNumber ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-medium text-gray-900 line-clamp-1">
                        {q.title}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <PublishedBadge published={q.isPublished} />
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {q.publishedAt
                        ? new Date(q.publishedAt).toLocaleDateString("en-CA")
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600">
                      {q.commentCount}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View on site */}
                        {q.isPublished && (
                          <Link href={`/ask-the-rabbi/${q.id}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <ExternalLink className="h-4 w-4 text-gray-500" />
                            </Button>
                          </Link>
                        )}
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditQuestion(q)}
                        >
                          <Pencil className="h-4 w-4 text-gray-500" />
                        </Button>
                        {/* Publish toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${
                            q.isPublished
                              ? "text-green-600 hover:text-red-600 hover:bg-red-50"
                              : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                          }`}
                          onClick={() => handleTogglePublish(q)}
                          disabled={togglingId === q.id}
                          title={q.isPublished ? "Unpublish" : "Publish"}
                        >
                          {togglingId === q.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : q.isPublished ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4 opacity-40" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">
                {pagination.totalCount} questions — page {pagination.page} of{" "}
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
      )}
    </>
  );
}

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
                      {new Date(comment.createdAt).toLocaleDateString("en-CA")}
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
              <QuestionsTab />
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
