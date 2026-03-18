"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageSquare, Loader2, CornerDownRight } from "lucide-react";
import Link from "next/link";

interface Comment {
  id: number;
  content: string;
  authorName: string;
  parentId: number | null;
  createdAt: string;
  approvalStatus?: string;
}

interface BlogCommentsProps {
  postSlug: string;
  moderationNotice?: boolean;
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

export function BlogComments({
  postSlug,
  moderationNotice = false,
}: BlogCommentsProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/blog/${postSlug}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      setComments(data);
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  }, [postSlug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitComment = async (content: string, parentId: number | null) => {
    const res = await fetch(`/api/blog/${postSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to submit comment" }));
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

  const topLevelComments = comments.filter((c) => c.parentId === null);
  const getReplies = (commentId: number) =>
    comments.filter((c) => c.parentId === commentId);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-600" />
        <h2 className="text-xl font-semibold">
          Comments{" "}
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
                    <span className="font-semibold text-sm">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {getRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                  {session?.user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-gray-500 h-7 px-2"
                      onClick={() =>
                        setReplyingTo(
                          replyingTo === comment.id ? null : comment.id
                        )
                      }
                    >
                      <CornerDownRight className="h-3 w-3 mr-1" />
                      Reply
                    </Button>
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
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
