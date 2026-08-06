"use client";

/**
 * The site-wide default for blog comment moderation.
 *
 * Its own page rather than a card bolted onto the moderation queue: the queue
 * page is a list view that reloads on every approve/reject, and a settings
 * form living inside that render cycle would either fight it or go stale.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Check,
  ShieldCheck,
  MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatInstant } from "@/lib/datetime";
import type { CommentModeration } from "@/lib/blog/comment-moderation";

const OPTIONS: {
  value: CommentModeration;
  title: string;
  description: string;
  icon: typeof MessagesSquare;
}[] = [
  {
    value: "open",
    title: "Publish immediately",
    description:
      "Comments appear on the post as soon as they are written. You remove problems afterwards from the moderation queue.",
    icon: MessagesSquare,
  },
  {
    value: "approved",
    title: "Hold for approval",
    description:
      "Every comment waits in the moderation queue until an admin approves it. Nothing appears on the post until someone checks.",
    icon: ShieldCheck,
  },
];

export default function BlogCommentSettingsPage() {
  const [moderation, setModeration] = useState<CommentModeration | null>(null);
  const [isExplicitlySet, setIsExplicitlySet] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<CommentModeration | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blog/comment-settings");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setModeration(data.moderation);
      setIsExplicitlySet(data.isExplicitlySet);
      setUpdatedAt(data.updatedAt);
    } catch {
      toast.error("Failed to load comment settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (value: CommentModeration) => {
    if (value === moderation && isExplicitlySet) return;
    setSaving(value);
    try {
      const res = await fetch("/api/admin/blog/comment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderation: value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setModeration(value);
      setIsExplicitlySet(true);
      setUpdatedAt(new Date().toISOString());
      toast.success(
        value === "approved"
          ? "New comments will now wait for approval"
          : "New comments will now publish immediately"
      );
    } catch {
      toast.error("Failed to save comment settings");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/programs/blog/comments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to comments
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comment Settings</h1>
        <p className="text-gray-500 mt-1">
          The default for every blog post. An individual post can override this
          when it is written.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {!isExplicitlySet && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This has never been set. The site is behaving as{" "}
              <strong>Publish immediately</strong> by default. Choosing an
              option below records it explicitly.
            </div>
          )}

          <div className="space-y-3">
            {OPTIONS.map((option) => {
              const isCurrent = moderation === option.value;
              const Icon = option.icon;
              return (
                <Card
                  key={option.value}
                  className={
                    isCurrent
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "hover:border-gray-300"
                  }
                >
                  <CardContent className="flex items-start gap-4 p-5">
                    <Icon
                      className={`h-5 w-5 mt-0.5 shrink-0 ${
                        isCurrent ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900">
                          {option.title}
                        </h2>
                        {isCurrent && (
                          <Badge className="bg-blue-100 text-blue-800">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {option.description}
                      </p>
                    </div>
                    <Button
                      variant={isCurrent ? "outline" : "default"}
                      size="sm"
                      disabled={saving !== null || (isCurrent && isExplicitlySet)}
                      onClick={() => save(option.value)}
                    >
                      {saving === option.value ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isCurrent && isExplicitlySet ? (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          In use
                        </>
                      ) : (
                        "Use this"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {updatedAt && (
            <p className="text-xs text-gray-400 mt-4">
              Last changed {formatInstant(updatedAt)}
            </p>
          )}

          <div className="mt-8 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-900">
              This is not the only control
            </p>
            <p>
              A single post can override this setting when it is written or
              edited, and that override wins.
            </p>
            <p>
              An individual person can also be set to{" "}
              <strong>Requires Approval</strong> or <strong>Blocked</strong> in{" "}
              <Link
                href="/admin/users"
                className="text-blue-600 hover:underline"
              >
                Users
              </Link>
              , which applies no matter what this page says. Those settings
              affect what someone writes from that point on — comments already
              posted stay where they are.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
