"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageSquare, Loader2, CornerDownRight, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { applyTombstones } from "@/lib/comments/tombstone";

/** Stand-in timestamp for the optimistic update; only its presence matters. */
const DELETED = new Date(0);

interface CommentThreadComment {
  id: number;
  authorId: number | null;
  content: string;
  /** Null on a tombstone — the API strips the author of a deleted comment. */
  authorName: string | null;
  parentId: number | null;
  createdAt: string;
  approvalStatus?: string;
  /**
   * A deleted comment kept only because live replies hang off it. Its text and
   * author are already gone by the time it reaches here; this flag exists so
   * the row can be styled as a tombstone and stripped of its actions.
   */
  isDeleted?: boolean;
  /** Set when the AUTHOR changed the text. Shown, because a reply quoting a
   *  comment that has since changed misleads everyone reading afterwards. */
  editedAt?: string | null;
}

interface CommentThreadProps {
  /**
   * Base URL for the comments API (no trailing slash).
   * GET {apiBase} → fetches list
   * POST {apiBase} → submits { content, parentId }
   */
  apiBase: string;

  /**
   * Whether to show the moderation notice banner.
   */
  moderationNotice?: boolean;

  /**
   * Whether comments are allowed at all.
   * When false, renders a "Comments are disabled" message instead of the input.
   * Default: true
   */
  commentsEnabled?: boolean;

  /**
   * Optional label override for the section heading. Default: "Comments"
   */
  label?: string;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

export function CommentThread({
  apiBase,
  moderationNotice = false,
  commentsEnabled = true,
  label = "Comments",
}: CommentThreadProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<CommentThreadComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEditId, setSavingEditId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      setComments(data);
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitComment = async (content: string, parentId: number | null) => {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Failed to submit comment" }));
      throw new Error(err.error || "Failed to submit comment");
    }

    return res.json();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await submitComment(newComment.trim(), null);

      if (result.approvalStatus === "approved") {
        setComments((prev) => [result, ...prev]);
        toast.success("Comment posted");
      } else {
        toast.success("Your comment has been submitted for approval");
      }
      setNewComment("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post comment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (!replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
      const result = await submitComment(replyContent.trim(), parentId);

      if (result.approvalStatus === "approved") {
        setComments((prev) => [...prev, result]);
        toast.success("Reply posted");
      } else {
        toast.success("Your comment has been submitted for approval");
      }
      setReplyContent("");
      setReplyingTo(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post reply"
      );
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const submitEdit = async (commentId: number, content: string) => {
    const res = await fetch(`${apiBase}?commentId=${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to edit comment");
    return data;
  };

  const handleSubmitEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    setSavingEditId(commentId);
    try {
      const updated = await submitEdit(commentId, editContent.trim());

      // An edit is re-moderated exactly like a new comment, so it can come
      // back pending. Dropping it from the list is the honest render: it is no
      // longer public, and leaving the new text on screen would tell the
      // author it went live.
      if (updated.approvalStatus === "approved") {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, content: updated.content, editedAt: updated.editedAt }
              : c
          )
        );
        toast.success("Comment updated");
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Your edit has been submitted for approval");
      }

      setEditingId(null);
      setEditContent("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to edit comment"
      );
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`${apiBase}?commentId=${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      // Dropping the row locally would orphan its replies in the UI until a
      // reload — the same defect the server side just stopped doing. Reuse the
      // one rule so the optimistic update matches what a refetch would return.
      setComments((prev) =>
        applyTombstones(
          prev.map((c) => ({
            ...c,
            // The list has no timestamps; any non-null value means "deleted".
            deletedAt: c.id === commentId || c.isDeleted ? DELETED : null,
          }))
        ).map((c) => ({
          id: c.id,
          authorId: c.isDeleted ? null : c.authorId,
          content: c.content,
          parentId: c.parentId,
          createdAt: c.createdAt,
          approvalStatus: c.approvalStatus,
          isDeleted: c.isDeleted,
          authorName: c.isDeleted ? null : c.authorName,
        }))
      );
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeletingId(null);
    }
  };

  const currentUserId = session?.user?.id ? parseInt(session.user.id) : null;
  const isAdmin = session?.user?.role === "admin";
  const canModerate = isAdmin || session?.user?.canManageAskTheRabbi === true;


  /**
   * The body of one comment: the text, or the inline editor when it is being
   * edited, plus the "edited" marker.
   *
   * A plain function rather than a component so React does not remount the
   * Textarea on every keystroke — a nested component defined during render is
   * a new type each time, which loses focus and the cursor position.
   */
  const renderBody = (comment: CommentThreadComment) => {
    if (editingId === comment.id) {
      return (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setEditingId(null);
                setEditContent("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSubmitEdit(comment.id)}
              disabled={
                savingEditId === comment.id ||
                !editContent.trim() ||
                editContent.trim() === comment.content
              }
            >
              {savingEditId === comment.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <>
        <p
          className={
            comment.isDeleted
              ? "text-sm italic text-gray-400"
              : "text-sm text-gray-700 whitespace-pre-wrap"
          }
        >
          {comment.isDeleted
            ? "This comment was removed. The replies below it were kept."
            : comment.content}
        </p>
        {comment.editedAt && !comment.isDeleted && (
          <span className="text-xs text-gray-400 italic">edited</span>
        )}
      </>
    );
  };

  /** Only the author edits — never an admin. Rewriting someone else's words
   *  under their name is worse than anything moderation prevents. */
  const canEdit = (comment: CommentThreadComment) =>
    !comment.isDeleted &&
    currentUserId !== null &&
    currentUserId === comment.authorId;

  const startEdit = (comment: CommentThreadComment) => {
    setReplyingTo(null);
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const topLevelComments = comments.filter((c) => c.parentId === null);
  const getReplies = (commentId: number) =>
    comments.filter((c) => c.parentId === commentId);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-600" />
        <h2 className="text-xl font-semibold">
          {label}{" "}
          {comments.length > 0 && (
            <span className="text-gray-400 font-normal">
              ({comments.length})
            </span>
          )}
        </h2>
      </div>

      {/* Moderation Notice */}
      {moderationNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Comments are moderated and will appear after approval.
        </div>
      )}

      {/* Comments disabled guard */}
      {!commentsEnabled ? (
        <Card className="p-4 text-center text-sm text-gray-500">
          Comments are disabled for this post.
        </Card>
      ) : (
        <>
          {/* New Comment Input */}
          {session?.user ? (
            <div className="space-y-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={isSubmitting || !newComment.trim()}
                  size="sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Posting...
                    </>
                  ) : (
                    "Post Comment"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Card className="p-4 text-center text-sm text-gray-500">
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Log in
              </Link>{" "}
              to comment
            </Card>
          )}

          {/* Comments List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : topLevelComments.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              No comments yet. Be the first to share your thoughts.
            </p>
          ) : (
            <div className="space-y-4">
              {topLevelComments.map((comment) => {
                const replies = getReplies(comment.id);

                return (
                  <div key={comment.id}>
                    {/* Top-level comment */}
                    <Card className="p-4">
                      <div className="flex items-baseline justify-between mb-1">
                        <span
                          className={
                            comment.isDeleted
                              ? "text-sm italic text-gray-400"
                              : "font-semibold text-sm"
                          }
                        >
                          {comment.isDeleted
                            ? "Deleted comment"
                            : comment.authorName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {getRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      {renderBody(comment)}
                      {/*
                        No Reply and no Delete on a tombstone. Replying would
                        attach a new comment to something nobody can read, and
                        there is nothing left to delete.
                      */}
                      {session?.user && !comment.isDeleted && (
                        <div className="flex items-center gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-gray-500 h-7 px-2"
                            onClick={() =>
                              setReplyingTo(
                                replyingTo === comment.id ? null : comment.id
                              )
                            }
                          >
                            <CornerDownRight className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          {canEdit(comment) && editingId !== comment.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-gray-500 h-7 px-2"
                              onClick={() => startEdit(comment)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          {(canModerate || currentUserId === comment.authorId) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 h-7 px-2"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deletingId === comment.id}
                            >
                              {deletingId === comment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Reply Input */}
                      {replyingTo === comment.id && (
                        <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                          <Textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyContent("");
                              }}
                              className="text-xs h-7"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSubmitReply(comment.id)}
                              disabled={
                                isSubmittingReply || !replyContent.trim()
                              }
                              className="text-xs h-7"
                            >
                              {isSubmittingReply ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Reply"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="ml-6 mt-2 space-y-2">
                        {replies.map((reply) => (
                          <Card
                            key={reply.id}
                            className="p-3 bg-gray-50/50 border-gray-200"
                          >
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="font-semibold text-sm">
                                {reply.authorName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {getRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            {renderBody(reply)}
                            {canEdit(reply) && editingId !== reply.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-gray-500 h-6 px-1.5 mt-1"
                                onClick={() => startEdit(reply)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {(isAdmin || currentUserId === reply.authorId) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 h-6 px-1.5 mt-1"
                                onClick={() => handleDeleteComment(reply.id)}
                                disabled={deletingId === reply.id}
                              >
                                {deletingId === reply.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
