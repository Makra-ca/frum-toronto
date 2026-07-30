"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { aspectWarning, type AspectWarning } from "@/lib/ads/aspect";

interface SubmittedAd {
  id: number;
  title: string;
  imageUrl: string;
  placement: string;
  linkType: string;
  linkUrl: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  isActive: boolean;
  clickCount: number;
}

type Placement = "banner" | "sidebar";

const PLACEMENT_LABELS: Record<Placement, string> = {
  banner: "Banner across the top",
  sidebar: "Sidebar",
};

const STATUS: Record<
  SubmittedAd["approvalStatus"],
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: { label: "Awaiting review", className: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "Running", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { label: "Not approved", className: "bg-red-100 text-red-700", icon: XCircle },
};

/**
 * Lets a business submit homepage artwork for review, and see what happened to
 * it.
 *
 * Only rendered when the plan grants a homepage position. The form hides options
 * the plan does not include, but the API checks the plan again — hiding a field
 * is presentation, not a permission.
 */
export function HomepageAdSubmission({ businessId }: { businessId: number }) {
  const [ads, setAds] = useState<SubmittedAd[]>([]);
  const [allowed, setAllowed] = useState<Placement[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>("banner");
  const [linkType, setLinkType] = useState<"own" | "external" | "none">("own");
  const [linkUrl, setLinkUrl] = useState("");
  const [warning, setWarning] = useState<AspectWarning | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/ads?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed to load");
      const payload = await res.json();
      setAds(payload.ads ?? []);
      setAllowed(payload.allowedPlacements ?? []);
      setRemaining(payload.remaining ?? 0);
      if (payload.allowedPlacements?.length) setPlacement(payload.allowedPlacements[0]);
    } catch {
      toast.error("Could not load your homepage ads");
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  // Measure the uploaded artwork and warn if it suits the chosen slot badly.
  // Re-runs on placement too: the same image can fit one and waste the other.
  useEffect(() => {
    if (!imageUrl) {
      setWarning(null);
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      // A business picks "sidebar"; the side is decided server-side, and both
      // sides have identical proportions, so either is fine for measuring.
      const slot = placement === "banner" ? "banner" : "sidebar-left";
      setWarning(aspectWarning(slot, image.naturalWidth, image.naturalHeight));
    };
    image.onerror = () => {
      if (!cancelled) setWarning(null);
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, placement]);

  function reset() {
    setTitle("");
    setImageUrl(null);
    setLinkType("own");
    setLinkUrl("");
    setError(null);
    setWarning(null);
  }

  async function submit() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          title,
          imageUrl,
          placement,
          linkType,
          linkUrl: linkType === "external" ? linkUrl : null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Could not submit your ad");
      }
      toast.success("Submitted — we'll review it shortly");
      setIsOpen(false);
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your ad");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(ad: SubmittedAd) {
    if (!window.confirm(`Remove "${ad.title}" from the homepage?`)) return;
    try {
      const res = await fetch(`/api/user/ads/${ad.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Ad removed");
      await load();
    } catch {
      toast.error("Could not remove the ad");
    }
  }

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Homepage advertising</h3>
          <p className="mt-1 text-sm text-gray-600">
            Your plan includes {allowed.map((p) => PLACEMENT_LABELS[p].toLowerCase()).join(" and ")}
            {" "}on the homepage. Upload your artwork and we&apos;ll review it before it goes live.
          </p>
        </div>
        {!isOpen && remaining > 0 && (
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add artwork
          </Button>
        )}
      </div>

      {ads.length > 0 && (
        <ul className="mt-4 space-y-2">
          {ads.map((ad) => {
            const status = STATUS[ad.approvalStatus];
            const Icon = status.icon;
            return (
              <li key={ad.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-14 w-24 flex-shrink-0 overflow-hidden rounded bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ad.imageUrl} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{ad.title}</span>
                    <Badge className={status.className}>
                      <Icon className="mr-1 h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                  {ad.approvalStatus === "approved" && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ad.clickCount} click{ad.clickCount === 1 ? "" : "s"}
                    </p>
                  )}
                  {/* The reason has to be shown, or "not approved" is a dead end
                      with no way to act on it. */}
                  {ad.approvalStatus === "rejected" && ad.rejectionReason && (
                    <p className="mt-0.5 text-xs text-red-700">{ad.rejectionReason}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => remove(ad)}
                  className="text-red-600 hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {ads.length === 0 && !isOpen && (
        <p className="mt-4 text-sm text-gray-500">
          You have no homepage artwork yet.
        </p>
      )}

      {remaining === 0 && !isOpen && ads.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          You have reached the maximum number of ads. Remove one to add another.
        </p>
      )}

      {isOpen && (
        <form
          className="mt-5 space-y-4 border-t pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div>
            <Label htmlFor="ad-sub-title">Title</Label>
            <Input
              id="ad-sub-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Summer sale"
              maxLength={200}
            />
          </div>

          <div>
            <Label>Artwork</Label>
            <ImageDropzone
              value={imageUrl}
              onChange={setImageUrl}
              folder="homepage-ads"
              aspectRatio={placement === "banner" ? "banner" : "square"}
            />
          </div>

          {warning && (
            <div
              role="status"
              className={`rounded-md border p-3 text-sm ${
                warning.severity === "severe"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
            >
              {warning.message}
            </div>
          )}

          {allowed.length > 1 && (
            <div>
              <Label htmlFor="ad-sub-placement">Where it appears</Label>
              <Select
                value={placement}
                onValueChange={(next) => setPlacement(next as Placement)}
              >
                <SelectTrigger id="ad-sub-placement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PLACEMENT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="ad-sub-link">Where it links</Label>
            <Select
              value={linkType}
              onValueChange={(next) => setLinkType(next as typeof linkType)}
            >
              <SelectTrigger id="ad-sub-link">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own">My listing on FrumToronto</SelectItem>
                <SelectItem value="external">My own website</SelectItem>
                <SelectItem value="none">No link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {linkType === "external" && (
            <div>
              <Label htmlFor="ad-sub-url">Web address</Label>
              <Input
                id="ad-sub-url"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="mybusiness.com"
                maxLength={500}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !imageUrl || !title.trim()}>
              {isSaving ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
