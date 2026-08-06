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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  EDITABLE_FIELDS,
  EDIT_ENDPOINT,
  singular,
  type ApprovalType,
} from "@/components/admin/approvals/approval-edit-fields";
import {
  toDateInputValue,
  toTimeInputValue,
  fromDateTimeInputs,
} from "@/lib/datetime";

/**
 * Correcting an item from the Approvals queue before saying yes to it.
 *
 * The queue used to be read-only: approve or reject, nothing else. An event
 * submitted with the wrong time could only be approved wrong, rejected (which
 * emails the submitter a rejection), or fixed by leaving the queue entirely.
 *
 * ## Fetch the whole row, send the whole row
 *
 * The dialog GETs the full record on open and PATCHes the full record back with
 * the edits merged in. That is not laziness — the four endpoints disagree:
 * simchas, tehillim and classifieds take partials, but `events` PATCH validates
 * with `eventSchema.parse()`, which is NOT partial and requires `title`,
 * `startTime` **and** `isAllDay`. Sending only the changed keys would 400 on
 * events alone. Merging satisfies both shapes with one code path.
 *
 * It also means fields this dialog does not show are carried through untouched
 * rather than being wiped by omission.
 */

interface Props {
  type: ApprovalType;
  id: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the queue re-render the card with the corrected values. */
  onSaved: (updated: Record<string, unknown>) => void;
}

export function ApprovalEditDialog({ type, id, open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** The full row as fetched — the base the edits are merged onto. */
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = EDITABLE_FIELDS[type];

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setRow(null);

    fetch(`/api/admin/${EDIT_ENDPOINT[type]}/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // Some routes wrap the record, others return it bare.
        const record = (data?.alert ?? data?.data ?? data) as Record<string, unknown>;
        setRow(record);

        const next: Record<string, string> = {};
        for (const f of fields) {
          const raw = record?.[f.name];
          if (raw == null) {
            next[f.name] = "";
            next[`${f.name}__time`] = "";
            continue;
          }
          if (f.kind === "datetime") {
            // Split into date + time so both read as Toronto wall clock.
            next[f.name] = toDateInputValue(raw as string);
            next[`${f.name}__time`] = toTimeInputValue(raw as string);
          } else if (f.kind === "date") {
            // A DATE column. toDateInputValue would apply a timezone shift to
            // a value that has no timezone, landing it a day early — so the
            // first 10 characters are taken as-is.
            next[f.name] = String(raw).slice(0, 10);
          } else {
            next[f.name] = String(raw);
          }
        }
        setValues(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load this item");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, type, id, fields]);

  const set = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const save = async () => {
    if (!row) return;
    setSaving(true);

    // Start from the fetched row so untouched fields survive, then overlay.
    const payload: Record<string, unknown> = { ...row };

    for (const f of fields) {
      const v = values[f.name] ?? "";

      if (f.kind === "datetime") {
        if (!v) {
          payload[f.name] = null;
          continue;
        }
        const iso = fromDateTimeInputs(v, values[`${f.name}__time`] || "12:00");
        if (!iso) {
          toast.error(`${f.label} is not a valid date and time`);
          setSaving(false);
          return;
        }
        payload[f.name] = iso;
      } else if (f.kind === "date") {
        payload[f.name] = v || null;
      } else if (f.kind === "number") {
        // Empty means "no price", not zero. And the column is numeric, so a
        // non-numeric string would 500 rather than fail validation.
        if (v.trim() === "") {
          payload[f.name] = null;
        } else if (Number.isFinite(Number(v))) {
          payload[f.name] = v.trim();
        } else {
          toast.error(`${f.label} must be a number`);
          setSaving(false);
          return;
        }
      } else {
        payload[f.name] = v.trim() === "" ? null : v.trim();
      }
    }

    // approvalStatus is deliberately NOT sent. setApprovalStatus owns it, and
    // an edit must never move an item's status as a side effect — that is what
    // the approve and reject buttons are for.
    delete payload.approvalStatus;

    try {
      const res = await fetch(`/api/admin/${EDIT_ENDPOINT[type]}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Could not save the changes");
        setSaving(false);
        return;
      }

      const saved = await res.json();
      toast.success("Changes saved");
      onSaved((saved?.alert ?? saved?.data ?? saved) as Record<string, unknown>);
      onOpenChange(false);
    } catch {
      toast.error("Could not save the changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit this {singular(type)}</DialogTitle>
          <DialogDescription>
            Fix anything that needs correcting, then approve it. Saving does not
            approve or reject — the status is unchanged.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label htmlFor={`edit-${f.name}`}>{f.label}</Label>

                {f.kind === "textarea" ? (
                  <Textarea
                    id={`edit-${f.name}`}
                    rows={4}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : f.kind === "datetime" ? (
                  <div className="flex gap-2">
                    <Input
                      id={`edit-${f.name}`}
                      type="date"
                      className="flex-1"
                      value={values[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                    <Input
                      type="time"
                      className="w-32"
                      aria-label={`${f.label} time`}
                      value={values[`${f.name}__time`] ?? ""}
                      onChange={(e) => set(`${f.name}__time`, e.target.value)}
                    />
                  </div>
                ) : (
                  <Input
                    id={`edit-${f.name}`}
                    type={
                      f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"
                    }
                    step={f.kind === "number" ? "0.01" : undefined}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </div>
            ))}

            <p className="text-xs text-gray-500">
              Times are Toronto time, the same as everywhere else on the site.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading || !row}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
