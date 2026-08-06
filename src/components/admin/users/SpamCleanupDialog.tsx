"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatInstant } from "@/lib/datetime";

/**
 * Clearing the bot signups.
 *
 * The cohort is computed server-side — unverified, created in the last 30 days,
 * owning nothing anywhere — and every row is listed with its name, address and
 * join date so the decision is made on evidence rather than a count.
 *
 * All rows start ticked, because in practice they are all keyboard-mash names
 * on scraped addresses. Anything that looks wrong can simply be unticked.
 *
 * The 30-day window is the load-bearing part and is NOT adjustable here.
 * Widening it starts to include long-standing unverified accounts, one of which
 * is `rochel@frumtoronto.com` — unverified, and the author of 1,395 blog posts.
 */

interface Candidate {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
}

export function SpamCleanupDialog({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (deletedIds: number[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [windowDays, setWindowDays] = useState(30);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    fetch("/api/admin/users/spam-cohort")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: Candidate[] = data.candidates ?? [];
        setCandidates(list);
        setWindowDays(data.windowDays ?? 30);
        setSelected(new Set(list.map((c) => c.id)));
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load the signup list");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allTicked = candidates.length > 0 && selected.size === candidates.length;

  const runDelete = async () => {
    setDeleting(true);
    setProgress(0);

    const removed: number[] = [];
    const failures: string[] = [];
    const ids = candidates.filter((c) => selected.has(c.id)).map((c) => c.id);

    // Sequential, one request each. Every candidate owns nothing by
    // construction, so `purge` and `reassign` are identical here — purge is
    // passed because it states the intent.
    for (const id of ids) {
      try {
        const res = await fetch(`/api/admin/users/${id}?mode=purge`, {
          method: "DELETE",
        });
        if (res.ok) removed.push(id);
        else {
          const body = await res.json().catch(() => ({}));
          failures.push(`${id}: ${body.error ?? res.status}`);
        }
      } catch {
        failures.push(`${id}: request failed`);
      }
      setProgress((p) => p + 1);
    }

    setDeleting(false);

    if (removed.length > 0) {
      toast.success(`${removed.length} signups removed`);
      onDeleted(removed);
    }
    if (failures.length > 0) {
      toast.error(
        `${failures.length} could not be removed. First: ${failures[0]}`
      );
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clear bot signups</DialogTitle>
          <DialogDescription>
            Accounts that never verified their email, signed up in the last{" "}
            {windowDays} days, and have never posted anything. Accounts that have
            posted — or that have been here longer — are never listed, whatever
            they look like.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding unverified signups…
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">
            Nothing to clear — no unverified signups in the last {windowDays}{" "}
            days.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={allTicked}
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked ? new Set(candidates.map((c) => c.id)) : new Set()
                    )
                  }
                />
                Select all
              </label>
              <span className="text-sm text-gray-500">
                {selected.size} of {candidates.length} selected
              </span>
            </div>

            <ul className="divide-y max-h-80 overflow-y-auto">
              {candidates.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 py-2 cursor-pointer">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">
                          {name || c.email}
                        </span>
                        {name && (
                          <span className="block text-xs text-gray-500 truncate">
                            {c.email}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {c.createdAt
                          ? formatInstant(new Date(c.createdAt), {
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={runDelete}
            disabled={deleting || selected.size === 0}
            className="gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Removing {progress} of {selected.size}…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Remove {selected.size}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
