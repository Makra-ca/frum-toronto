"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { BusinessPicker, type PickableBusiness } from "@/components/admin/BusinessPicker";
import { AD_PLACEMENTS, AD_PLACEMENT_LABELS, type AdPlacement } from "@/lib/ads/live-ads";
import { aspectWarning, type AspectWarning } from "@/lib/ads/aspect";

export interface AdFormValues {
  id?: number;
  title: string;
  imageUrl: string | null;
  placement: AdPlacement;
  linkType: "business" | "external" | "none";
  linkUrl: string;
  business: PickableBusiness | null;
  startsAt: string;
  endsAt: string;
}

export const EMPTY_AD: AdFormValues = {
  title: "",
  imageUrl: null,
  placement: "banner",
  linkType: "none",
  linkUrl: "",
  business: null,
  startsAt: "",
  endsAt: "",
};

interface AdFormProps {
  value: AdFormValues;
  onChange: (next: AdFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  error?: string | null;
}

/**
 * Create/edit form for an ad.
 *
 * The aspect-ratio warning is measured from the ACTUAL uploaded image rather
 * than from anything the advertiser claims, by loading it and reading its
 * natural dimensions. It re-evaluates when the position changes, because the
 * same artwork can be fine in one slot and useless in another.
 */
export function AdForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSaving = false,
  error = null,
}: AdFormProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [warning, setWarning] = useState<AspectWarning | null>(null);

  const set = <K extends keyof AdFormValues>(key: K, next: AdFormValues[K]) =>
    onChange({ ...value, [key]: next });

  // Measure the image once it is available.
  useEffect(() => {
    if (!value.imageUrl) {
      setDimensions(null);
      return;
    }

    // Declared inside the effect, so each run gets a fresh flag. A ref declared
    // outside would survive Strict Mode's setup/cleanup/setup and stay stuck at
    // the cleanup value — the bug that once disabled the zmanim GPS button.
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (!cancelled) setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (!cancelled) setDimensions(null);
    };
    image.src = value.imageUrl;

    return () => {
      cancelled = true;
    };
  }, [value.imageUrl]);

  // Recompute whenever the image OR the position changes.
  useEffect(() => {
    if (!dimensions) {
      setWarning(null);
      return;
    }
    setWarning(aspectWarning(value.placement, dimensions.width, dimensions.height));
  }, [dimensions, value.placement]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <Label htmlFor="ad-title">Title</Label>
        <Input
          id="ad-title"
          value={value.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="TorahMasters Semicha Programme"
          maxLength={200}
        />
        <p className="mt-1 text-xs text-gray-500">
          Not shown to visitors — this is how you identify the ad in this list.
        </p>
      </div>

      <div>
        <Label>Image</Label>
        <ImageDropzone
          value={value.imageUrl}
          onChange={(url) => set("imageUrl", url)}
          folder="homepage-ads"
          aspectRatio={value.placement === "banner" ? "banner" : "square"}
        />
        {dimensions && (
          <p className="mt-1 text-xs text-gray-500">
            {dimensions.width} × {dimensions.height} px
          </p>
        )}
      </div>

      {warning && (
        <div
          role="status"
          className={`flex gap-2 rounded-md border p-3 text-sm ${
            warning.severity === "severe"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          {warning.severity === "severe" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          {/* A warning, never a block: a deliberate letterbox is a valid choice,
              and the full flyer is readable in the overlay either way. */}
          <p>{warning.message}</p>
        </div>
      )}

      <div>
        <Label htmlFor="ad-placement">Position</Label>
        <Select
          value={value.placement}
          onValueChange={(next) => set("placement", next as AdPlacement)}
        >
          <SelectTrigger id="ad-placement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AD_PLACEMENTS.map((placement) => (
              <SelectItem key={placement} value={placement}>
                {AD_PLACEMENT_LABELS[placement]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="ad-link-type">Where it links</Label>
        <Select
          value={value.linkType}
          onValueChange={(next) => set("linkType", next as AdFormValues["linkType"])}
        >
          <SelectTrigger id="ad-link-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No link — flyer only</SelectItem>
            <SelectItem value="business">A business page on this site</SelectItem>
            <SelectItem value="external">An external website</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-gray-500">
          Chosen, not guessed. &ldquo;No link&rdquo; is a real option — a flyer carrying a phone
          number needs no click-through.
        </p>
      </div>

      {value.linkType === "external" && (
        <div>
          <Label htmlFor="ad-link-url">Web address</Label>
          <Input
            id="ad-link-url"
            value={value.linkUrl}
            onChange={(event) => set("linkUrl", event.target.value)}
            placeholder="torahmasters.org"
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">
            You can leave off https:// — it is added for you.
          </p>
        </div>
      )}

      {value.linkType === "business" && (
        <div>
          <Label htmlFor="ad-business">Business</Label>
          <BusinessPicker
            id="ad-business"
            value={value.business}
            onChange={(business) => set("business", business)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ad-starts">Starts (optional)</Label>
          <Input
            id="ad-starts"
            type="date"
            value={value.startsAt}
            onChange={(event) => set("startsAt", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ad-ends">Ends (optional)</Label>
          <Input
            id="ad-ends"
            type="date"
            value={value.endsAt}
            onChange={(event) => set("endsAt", event.target.value)}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Leave blank to run indefinitely. An ad stops showing on its own after the end date.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !value.imageUrl || !value.title.trim()}>
          {isSaving ? "Saving…" : value.id ? "Save changes" : "Add ad"}
        </Button>
      </div>
    </form>
  );
}
