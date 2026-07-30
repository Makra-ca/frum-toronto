"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdForm, EMPTY_AD, type AdFormValues } from "@/components/admin/AdForm";
import {
  AD_PLACEMENTS,
  AD_PLACEMENT_LABELS,
  ADS_PER_POSITION,
  type AdPlacement,
} from "@/lib/ads/live-ads";

interface AdminAd {
  id: number;
  title: string;
  imageUrl: string;
  placement: AdPlacement;
  linkType: "business" | "external" | "none";
  linkUrl: string | null;
  businessId: number | null;
  businessName: string | null;
  businessSlug: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
}

type AdState = "live" | "scheduled" | "expired" | "pending" | "rejected" | "off";

/**
 * What an ad is actually doing right now.
 *
 * Mirrors `liveAdCondition` in `src/lib/ads/live-ads.ts`. The order matters:
 * moderation and the active flag come first, because a rejected or switched-off
 * ad is not "scheduled", it simply is not running.
 */
function adState(ad: AdminAd, now: Date): AdState {
  if (ad.approvalStatus === "pending") return "pending";
  if (ad.approvalStatus === "rejected") return "rejected";
  if (!ad.isActive) return "off";
  if (ad.startsAt && new Date(ad.startsAt) > now) return "scheduled";
  if (ad.endsAt && new Date(ad.endsAt) < now) return "expired";
  return "live";
}

const STATE_STYLES: Record<AdState, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-emerald-100 text-emerald-800" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600" },
  pending: { label: "Pending review", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  off: { label: "Switched off", className: "bg-gray-100 text-gray-600" },
};

function toDateInput(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function describeLink(ad: AdminAd): string {
  if (ad.linkType === "external") return ad.linkUrl ?? "External link";
  if (ad.linkType === "business") return ad.businessName ?? "Business page";
  return "No link";
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AdFormValues>(EMPTY_AD);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ads");
      if (!res.ok) throw new Error("Failed to load ads");
      const payload = await res.json();
      setAds(payload.ads ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Could not load ads");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Recomputed per render rather than stored: "live" depends on the clock, and a
  // value frozen at load time would quietly go stale on a page left open.
  const now = new Date();

  const byPlacement = useMemo(() => {
    const groups = Object.fromEntries(
      AD_PLACEMENTS.map((placement) => [placement, [] as AdminAd[]])
    ) as Record<AdPlacement, AdminAd[]>;
    for (const ad of ads) groups[ad.placement]?.push(ad);
    return groups;
  }, [ads]);

  function startCreate() {
    setForm(EMPTY_AD);
    setFormError(null);
    setDialogOpen(true);
  }

  function startEdit(ad: AdminAd) {
    setForm({
      id: ad.id,
      title: ad.title,
      imageUrl: ad.imageUrl,
      placement: ad.placement,
      linkType: ad.linkType,
      linkUrl: ad.linkUrl ?? "",
      business: ad.businessId ? { id: ad.businessId, name: ad.businessName ?? "" } : null,
      startsAt: toDateInput(ad.startsAt),
      endsAt: toDateInput(ad.endsAt),
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function save() {
    setIsSaving(true);
    setFormError(null);

    const payload = {
      title: form.title,
      imageUrl: form.imageUrl,
      placement: form.placement,
      linkType: form.linkType,
      linkUrl: form.linkType === "external" ? form.linkUrl : null,
      businessId: form.business?.id ?? null,
      // Dates arrive as YYYY-MM-DD; the API expects an ISO instant.
      startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00Z`).toISOString() : null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59Z`).toISOString() : null,
    };

    try {
      const res = await fetch(form.id ? `/api/admin/ads/${form.id}` : "/api/admin/ads", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not save the ad");
      }

      toast.success(form.id ? "Ad updated" : "Ad added");
      setDialogOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the ad");
    } finally {
      setIsSaving(false);
    }
  }

  async function patch(ad: AdminAd, body: Record<string, unknown>, successMessage: string) {
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(successMessage);
      await load();
    } catch {
      toast.error("Could not update the ad");
    }
  }

  async function remove(ad: AdminAd) {
    // Deleting loses the ad's click history, so it asks first.
    if (!window.confirm(`Delete "${ad.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Ad deleted");
      await load();
    } catch {
      toast.error("Could not delete the ad");
    }
  }

  if (isLoading) {
    return <p className="py-12 text-center text-gray-500">Loading ads…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Homepage ads</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Each position shows {ADS_PER_POSITION} ads at a time, chosen at random from everything
            live in that position and rotating on the page. Order is not controlled — assigning an
            ad to a position is the decision.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add ad
        </Button>
      </div>

      {AD_PLACEMENTS.map((placement) => {
        const group = byPlacement[placement] ?? [];
        const liveCount = group.filter((ad) => adState(ad, now) === "live").length;

        return (
          <section key={placement} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
              <h3 className="text-lg font-medium text-gray-900">
                {AD_PLACEMENT_LABELS[placement]}
              </h3>
              {/*
                Pool size is the one thing that silently changes how often an
                advertiser is seen, and it is invisible otherwise.
              */}
              <p className="text-sm text-gray-600">
                {liveCount === 0
                  ? "Nothing live — the position shows the “Advertise here” placeholder"
                  : liveCount <= ADS_PER_POSITION
                    ? `${liveCount} live — all shown on every visit`
                    : `${liveCount} live competing for ${ADS_PER_POSITION} slots — each visitor sees ${ADS_PER_POSITION} at random`}
              </p>
            </div>

            {group.length === 0 ? (
              <p className="py-6 text-sm text-gray-500">No ads in this position yet.</p>
            ) : (
              <ul className="space-y-2">
                {group.map((ad) => {
                  const state = adState(ad, now);
                  const style = STATE_STYLES[state];
                  return (
                    <li
                      key={ad.id}
                      className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center"
                    >
                      <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ad.imageUrl}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{ad.title}</span>
                          <Badge className={style.className}>{style.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-600">
                          {describeLink(ad)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {ad.clickCount} click{ad.clickCount === 1 ? "" : "s"}
                          {ad.startsAt && ` · from ${toDateInput(ad.startsAt)}`}
                          {ad.endsAt && ` · until ${toDateInput(ad.endsAt)}`}
                        </p>
                        {ad.rejectionReason && (
                          <p className="mt-1 text-xs text-red-700">
                            Rejected: {ad.rejectionReason}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 flex-wrap gap-1">
                        {ad.approvalStatus === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                patch(ad, { approvalStatus: "approved" }, "Ad approved")
                              }
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = window.prompt("Reason for rejecting (optional):");
                                // null means the prompt was cancelled; an empty
                                // string means "rejected, no reason given".
                                if (reason === null) return;
                                patch(
                                  ad,
                                  { approvalStatus: "rejected", rejectionReason: reason || null },
                                  "Ad rejected"
                                );
                              }}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch(
                              ad,
                              { isActive: !ad.isActive },
                              ad.isActive ? "Ad switched off" : "Ad switched on"
                            )
                          }
                          title={ad.isActive ? "Switch off" : "Switch on"}
                        >
                          {ad.isActive ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>

                        {ad.linkType === "external" && ad.linkUrl && (
                          <Button size="sm" variant="outline" asChild title="Open link">
                            <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(ad)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => remove(ad)}
                          title="Delete"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit ad" : "Add ad"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Changes keep this ad's click history."
                : "Ads you add here are approved straight away."}
            </DialogDescription>
          </DialogHeader>
          <AdForm
            value={form}
            onChange={setForm}
            onSubmit={save}
            onCancel={() => setDialogOpen(false)}
            isSaving={isSaving}
            error={formError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
