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
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Deleting one or more accounts.
 *
 * Three phases, because deletion is irreversible and 19 foreign keys mean a
 * plain DELETE fails on any account that has ever posted:
 *
 *   1. DRY RUN — ask the API what each account owns. Writes nothing.
 *   2. CHOOSE — show the inventory. Accounts owning nothing can just go;
 *      accounts with content force a choice about that content.
 *   3. DELETE — one request per account, so every removal is guarded and
 *      audited individually, and one failure cannot take the others with it.
 *
 * The Ask the Rabbi warning is shown in EVERY mode, always, because the
 * database cascades those comments away before any of our code runs. There is
 * no option that preserves them, so the honest thing is to say so up front
 * rather than let it be discovered afterwards.
 */

export interface DeletableUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ContentCount {
  label: string;
  count: number;
}

interface Inventory {
  id: number;
  email: string;
  owned: ContentCount[];
  destroyed: ContentCount[];
  totalOwned: number;
  /** Set when the API refused outright (admin, self, archive account). */
  refusedReason?: string;
}

export function DeleteUsersDialog({
  targets,
  open,
  onOpenChange,
  onDeleted,
}: {
  targets: DeletableUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids actually removed, so the caller can drop them from its list. */
  onDeleted: (deletedIds: number[]) => void;
}) {
  const [inspecting, setInspecting] = useState(false);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || targets.length === 0) return;

    let cancelled = false;
    setInspecting(true);
    setInventories([]);

    (async () => {
      const results: Inventory[] = [];
      for (const user of targets) {
        try {
          const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
          const body = await res.json();

          if (res.status === 403) {
            results.push({
              id: user.id,
              email: user.email,
              owned: [],
              destroyed: [],
              totalOwned: 0,
              refusedReason: body.error,
            });
          } else {
            results.push({
              id: user.id,
              email: user.email,
              owned: body.owned ?? [],
              destroyed: body.destroyed ?? [],
              totalOwned: body.totalOwned ?? 0,
            });
          }
        } catch {
          results.push({
            id: user.id,
            email: user.email,
            owned: [],
            destroyed: [],
            totalOwned: 0,
            refusedReason: "Could not check this account.",
          });
        }
      }
      if (!cancelled) {
        setInventories(results);
        setInspecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, targets]);

  const deletable = inventories.filter((i) => !i.refusedReason);
  const refused = inventories.filter((i) => i.refusedReason);
  const withContent = deletable.filter((i) => i.totalOwned > 0);
  const clean = deletable.filter((i) => i.totalOwned === 0);
  const anyDestroyed = deletable.some((i) => i.destroyed.length > 0);

  const runDelete = async (mode: "reassign" | "purge") => {
    setDeleting(true);
    const removed: number[] = [];
    const failures: string[] = [];

    // One request per account. A single bulk endpoint would make one failure
    // ambiguous — did the others go through? — and this way each deletion gets
    // its own guard check and its own audit row.
    for (const target of deletable) {
      try {
        const res = await fetch(`/api/admin/users/${target.id}?mode=${mode}`, {
          method: "DELETE",
        });
        if (res.ok) removed.push(target.id);
        else {
          const body = await res.json().catch(() => ({}));
          failures.push(`${target.email}: ${body.error ?? res.status}`);
        }
      } catch {
        failures.push(`${target.email}: request failed`);
      }
    }

    setDeleting(false);

    if (removed.length > 0) {
      toast.success(
        removed.length === 1
          ? "Account deleted"
          : `${removed.length} accounts deleted`
      );
      onDeleted(removed);
    }
    // Reported individually, never silently skipped.
    if (failures.length > 0) {
      toast.error(
        failures.length === 1
          ? failures[0]
          : `${failures.length} could not be deleted. First: ${failures[0]}`
      );
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {targets.length === 1
              ? "Delete this account?"
              : `Delete ${targets.length} accounts?`}
          </DialogTitle>
          <DialogDescription>
            This cannot be undone. The Audit Log keeps a record of what was
            deleted and by whom.
          </DialogDescription>
        </DialogHeader>

        {inspecting ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking what these accounts own…
          </div>
        ) : (
          <div className="space-y-4">
            {refused.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-900 mb-1">
                  {refused.length === 1
                    ? "This account cannot be deleted"
                    : `${refused.length} cannot be deleted and will be skipped`}
                </p>
                <ul className="text-sm text-red-800 space-y-1">
                  {refused.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{r.email}</span> —{" "}
                      {r.refusedReason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {clean.length > 0 && (
              <div className="rounded-md border bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {clean.length === 1
                    ? "Ready to delete — owns nothing"
                    : `${clean.length} ready to delete — own nothing`}
                </p>
                <ul className="text-sm text-gray-600 max-h-40 overflow-y-auto">
                  {clean.map((c) => (
                    <li key={c.id}>{c.email}</li>
                  ))}
                </ul>
              </div>
            )}

            {withContent.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {withContent.length === 1
                    ? "This account has posted things"
                    : `${withContent.length} of these accounts have posted things`}
                </p>
                <ul className="text-sm text-amber-900 space-y-2 max-h-52 overflow-y-auto">
                  {withContent.map((c) => (
                    <li key={c.id}>
                      <div className="font-medium">{c.email}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.owned.map((o) => (
                          <Badge key={o.label} variant="secondary">
                            {o.count} {o.label.toLowerCase()}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {anyDestroyed && (
              // Always shown when present, in every mode. The database cascades
              // these away before our code runs; no option preserves them.
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-900">
                  <strong>Ask the Rabbi comments will be deleted either
                  way.</strong>{" "}
                  The database removes them automatically with the account —
                  there is no option that keeps them.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>

          {!inspecting && deletable.length > 0 && (
            <>
              {withContent.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => runDelete("reassign")}
                  disabled={deleting}
                  className="gap-2"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  Delete, keep their posts
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => runDelete("purge")}
                disabled={deleting}
                className="gap-2"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {withContent.length > 0
                  ? "Delete everything"
                  : deletable.length === 1
                    ? "Delete account"
                    : `Delete ${deletable.length} accounts`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
