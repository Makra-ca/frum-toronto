"use client";

/**
 * Site-wide comment moderation, one control per surface.
 *
 * It lives under Programs rather than under Blog because it governs BOTH
 * comment surfaces — an earlier version sat under Blog and was labelled
 * "Comment Settings", which read as site-wide while silently covering one of
 * the two. A control must not claim more authority than it has.
 *
 * Its own page rather than a card on the moderation queue: that page is a list
 * view which reloads on every approve/reject, and a settings form inside that
 * render cycle would either fight it or go stale.
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
import type { CommentModeration, CommentSurface } from "@/lib/comments/moderation";

type SurfaceState = {
  surface: CommentSurface;
  label: string;
  hasPerItemOverride: boolean;
  moderation: CommentModeration;
  isExplicitlySet: boolean;
  updatedAt: string | null;
};

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
      "Comments appear as soon as they are written. You remove problems afterwards from the moderation queue.",
    icon: MessagesSquare,
  },
  {
    value: "approved",
    title: "Hold for approval",
    description:
      "Every comment waits in the moderation queue until an admin approves it. Nothing appears until someone checks.",
    icon: ShieldCheck,
  },
];

export default function CommentSettingsPage() {
  const [surfaces, setSurfaces] = useState<SurfaceState[]>([]);
  const [loading, setLoading] = useState(true);
  // Keyed by surface so two saves cannot disable each other's buttons.
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/comment-settings");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSurfaces(data.surfaces);
    } catch {
      toast.error("Failed to load comment settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (surface: SurfaceState, value: CommentModeration) => {
    if (value === surface.moderation && surface.isExplicitlySet) return;
    setSaving(`${surface.surface}:${value}`);
    try {
      const res = await fetch("/api/admin/comment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: surface.surface, moderation: value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setSurfaces((prev) =>
        prev.map((s) =>
          s.surface === surface.surface
            ? {
                ...s,
                moderation: data.moderation,
                isExplicitlySet: true,
                updatedAt: data.updatedAt,
              }
            : s
        )
      );
      toast.success(
        value === "approved"
          ? `${surface.label} will now wait for approval`
          : `${surface.label} will now publish immediately`
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
          The default for each place people can comment. Set separately, so you
          can supervise one without the other.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {surfaces.map((surface) => (
              <section key={surface.surface}>
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="font-semibold text-gray-900">
                    {surface.label}
                  </h2>
                  {surface.updatedAt && (
                    <span className="text-xs text-gray-400">
                      Last changed {formatInstant(surface.updatedAt)}
                    </span>
                  )}
                </div>

                {!surface.isExplicitlySet && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                    Never set — behaving as{" "}
                    <strong>Publish immediately</strong> by default.
                  </div>
                )}

                <div className="space-y-3">
                  {OPTIONS.map((option) => {
                    const isCurrent = surface.moderation === option.value;
                    const Icon = option.icon;
                    const busy = saving === `${surface.surface}:${option.value}`;
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
                              <h3 className="font-medium text-gray-900">
                                {option.title}
                              </h3>
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
                            disabled={
                              saving !== null ||
                              (isCurrent && surface.isExplicitlySet)
                            }
                            onClick={() => save(surface, option.value)}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isCurrent && surface.isExplicitlySet ? (
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

                {surface.hasPerItemOverride && (
                  <p className="text-sm text-gray-500 mt-2">
                    A single post can override this when it is written or
                    edited, and that override wins.
                  </p>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-900">
              This is not the only control
            </p>
            <p>
              An individual person can be set to{" "}
              <strong>Requires Approval</strong> or <strong>Blocked</strong> in{" "}
              <Link href="/admin/users" className="text-blue-600 hover:underline">
                Users
              </Link>
              , which applies on both surfaces no matter what this page says.
              Those settings affect what someone writes from that point on —
              comments already posted stay where they are.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
