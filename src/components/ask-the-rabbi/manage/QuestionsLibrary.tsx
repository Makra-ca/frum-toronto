"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageSquare,
  Eye,
  Pencil,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { UniversalSearch } from "@/components/search/UniversalSearch";
import { formatInstant } from "@/lib/datetime";
import { QuestionEditDialog } from "./QuestionEditDialog";
import type { Question, Pagination } from "./types";

// The shell supplies the page heading — the admin panel inherits an <h1> from
// its Programs layout, the dashboard supplies its own CardTitle. A heading here
// would double up in one of them.

function PublishedBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-green-100 text-green-800 font-normal">Published</Badge>
  ) : (
    <Badge className="bg-gray-100 text-gray-600 font-normal">Draft</Badge>
  );
}


export function QuestionsLibrary() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = async (q: Question) => {
    if (!confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
    setDeletingId(q.id);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi?id=${q.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setQuestions((prev) => prev.filter((item) => item.id !== q.id));
      toast.success("Question deleted");
    } catch {
      toast.error("Failed to delete question");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <QuestionEditDialog
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
                        ? formatInstant(q.publishedAt, { month: "numeric", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600">
                      {q.commentCount}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View on site (published) / Preview (unpublished) */}
                        <Link href={`/ask-the-rabbi/${q.id}`} target="_blank">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title={q.isPublished ? "View on site" : "Preview (unpublished)"}
                          >
                            <ExternalLink
                              className={`h-4 w-4 ${q.isPublished ? "text-gray-500" : "text-amber-500"}`}
                            />
                          </Button>
                        </Link>
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
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(q)}
                          disabled={deletingId === q.id}
                          title="Delete question"
                        >
                          {deletingId === q.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
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
