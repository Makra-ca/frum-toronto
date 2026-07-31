"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, Plus, X } from "lucide-react";
import {
  liveWarningFor,
  type EditFieldSpec,
  type EditFormSpec,
} from "@/lib/submissions/edit-form-fields";

/**
 * The edit form for every type except events and blog, driven by a spec.
 *
 * Two things it must not get wrong:
 *
 *  - A `date` field is bound to the stored "YYYY-MM-DD" string verbatim. Never
 *    build a Date from it; that is what renders and then SAVES the day before.
 *  - The unpublish warning has to appear BEFORE the user commits, because
 *    unpublishing on edit is a deliberately accepted cost that the spec says
 *    is mitigated by warning and never by changing the rule.
 */

type FormValues = Record<string, string | string[]>;

function initialValue(spec: EditFieldSpec, raw: unknown): string | string[] {
  if (spec.kind === "stringList") {
    return Array.isArray(raw) ? (raw as string[]) : [];
  }
  if (raw == null) return "";
  // A lookup holds an id; the select works in strings.
  if (spec.kind === "lookup") return String(raw);
  // Date columns arrive as "YYYY-MM-DD"; slice defends against a driver that
  // ever hands back a full timestamp, without parsing it.
  if (spec.kind === "date") return String(raw).slice(0, 10);
  return String(raw);
}

export function SubmissionEditForm({ spec, id }: { spec: EditFormSpec; id: number }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({});
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Options for `lookup` fields, keyed by field name. */
  const [lookups, setLookups] = useState<
    Record<string, { value: string; label: string }[]>
  >({});

  useEffect(() => {
    let cancelled = false;

    const wanted = spec.fields.filter((f) => f.kind === "lookup" && f.optionsUrl);
    if (wanted.length === 0) return;

    Promise.all(
      wanted.map(async (field) => {
        try {
          const res = await fetch(field.optionsUrl!);
          if (!res.ok) return [field.name, []] as const;
          const rows = await res.json();
          const list = Array.isArray(rows) ? rows : (rows.data ?? rows.categories ?? []);
          return [
            field.name,
            (list as { id: number; name: string }[]).map((row) => ({
              value: String(row.id),
              label: row.name,
            })),
          ] as const;
        } catch {
          // A failed lookup leaves the select empty rather than blocking the
          // whole form — every other field is still editable.
          return [field.name, []] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setLookups(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [spec]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/community/${spec.folder}/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not load this submission");
        }
        return res.json();
      })
      .then((row) => {
        if (cancelled) return;
        const next: FormValues = {};
        for (const field of spec.fields) {
          next[field.name] = initialValue(field, row[field.name]);
        }
        setValues(next);
        setIsLive(row.approvalStatus === "approved");
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spec, id]);

  const setField = (name: string, value: string | string[]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    // Empty strings are sent as null so a cleared optional field actually
    // clears, rather than storing "".
    const payload: Record<string, unknown> = {};
    for (const field of spec.fields) {
      const value = values[field.name];
      if (Array.isArray(value)) {
        payload[field.name] = value.filter((v) => v.trim());
      } else if (field.kind === "lookup") {
        // The column is an integer; sending "3" is a type error the schema
        // rejects with a message about expecting a number.
        payload[field.name] = value?.trim() ? Number(value) : null;
      } else {
        payload[field.name] = value?.trim() ? value.trim() : null;
      }
    }

    try {
      const res = await fetch(`/api/community/${spec.folder}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok) {
        // 409 means someone reviewed it while this form was open. Its message
        // tells the user to reload, so it must not be replaced with a generic
        // failure.
        toast.error(body.error || "Could not save your changes");
        return;
      }

      toast.success(body.message || "Your changes were saved");
      router.push("/dashboard/submissions");
      router.refresh();
    } catch {
      toast.error("Could not save your changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {loadError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isLive && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{liveWarningFor(spec)}</p>
        </div>
      )}

      {spec.fields.map((field) => {
        const value = values[field.name];

        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-600"> *</span>}
            </Label>

            {field.kind === "textarea" ? (
              <Textarea
                id={field.name}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(field.name, e.target.value)}
                rows={4}
                required={field.required}
              />
            ) : field.kind === "select" || field.kind === "lookup" ? (
              <select
                id={field.name}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(field.name, e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                {!field.noBlank && <option value="">—</option>}
                {(field.kind === "lookup"
                  ? (lookups[field.name] ?? [])
                  : (field.options ?? [])
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === "stringList" ? (
              <StringList
                name={field.name}
                values={Array.isArray(value) ? value : []}
                onChange={(next) => setField(field.name, next)}
              />
            ) : (
              <Input
                id={field.name}
                type={
                  field.kind === "date"
                    ? "date"
                    : field.kind === "email"
                      ? "email"
                      : field.kind === "tel"
                        ? "tel"
                        : "text"
                }
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(field.name, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.help && <p className="text-xs text-gray-500">{field.help}</p>}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/dashboard/submissions")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StringList({
  name,
  values,
  onChange,
}: {
  name: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const rows = values.length ? values : [""];

  return (
    <div className="space-y-2">
      {rows.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            id={index === 0 ? name : undefined}
            value={value}
            onChange={(e) => {
              const next = [...rows];
              next[index] = e.target.value;
              onChange(next);
            }}
          />
          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, ""])}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add
      </Button>
    </div>
  );
}
