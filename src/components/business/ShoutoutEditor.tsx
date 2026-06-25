"use client";

import { useState, useRef } from "react";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Megaphone,
  AlertCircle,
  ImageIcon,
} from "lucide-react";

interface Shoutout {
  id: number;
  businessId: number;
  scheduledDate: string;
  contentHtml: string;
  imageUrl: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface ShoutoutEditorProps {
  businessId: number;
  existingShoutout: Shoutout | null;
  onSubmit: (shoutout: Shoutout) => void;
}

export function ShoutoutEditor({
  businessId,
  existingShoutout,
  onSubmit,
}: ShoutoutEditorProps) {
  const [scheduledDate, setScheduledDate] = useState(
    existingShoutout?.scheduledDate || ""
  );
  const [contentText, setContentText] = useState(
    // Strip HTML tags from existing content for the textarea
    existingShoutout?.contentHtml
      ? existingShoutout.contentHtml.replace(/<[^>]+>/g, "")
      : ""
  );
  const [imageUrl, setImageUrl] = useState<string | null>(existingShoutout?.imageUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Compute minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  function isDateDisabled(dateStr: string): boolean {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    // Disable Friday (5) and Saturday (6)
    return day === 5 || day === 6;
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      setError("Maximum file size is 30MB");
      e.target.value = "";
      return;
    }

    setSelectedImageFile(file);
    setIsUploadingImage(true);
    setError(null);

    try {
      const { url } = await uploadFile(file, "shoutouts");
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
      setSelectedImageFile(null);
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (!scheduledDate) {
      setError("Please select a scheduled date");
      return;
    }
    if (isDateDisabled(scheduledDate)) {
      setError("Please select a date that is not Friday or Saturday (Shabbat)");
      return;
    }
    if (!contentText.trim()) {
      setError("Please write your shoutout content");
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert plain text to basic HTML
      const contentHtml = contentText
        .split("\n\n")
        .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
        .join("");

      let res: Response;

      if (existingShoutout && existingShoutout.status === "rejected") {
        // Resubmit rejected shoutout via PATCH
        res = await fetch(
          `/api/businesses/${businessId}/shoutouts/${existingShoutout.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduledDate,
              contentHtml,
              imageUrl: imageUrl || null,
            }),
          }
        );
      } else {
        // New shoutout via POST
        res = await fetch(`/api/businesses/${businessId}/shoutouts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledDate,
            contentHtml,
            imageUrl: imageUrl || null,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      const newShoutout = await res.json();
      onSubmit(newShoutout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {existingShoutout?.status === "rejected" && existingShoutout.rejectionReason && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
          <XCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Rejection reason</p>
            <p className="text-xs text-amber-700 mt-0.5">{existingShoutout.rejectionReason}</p>
            <p className="text-xs text-gray-500 mt-1">
              Please revise your shoutout and resubmit.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="shoutout-date" className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Scheduled Date
        </Label>
        <input
          id="shoutout-date"
          type="date"
          min={minDate}
          value={scheduledDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val && isDateDisabled(val)) {
              setError("Please select a date that is not Friday or Saturday (Shabbat)");
            } else {
              setError(null);
            }
            setScheduledDate(val);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-xs"
        />
        <p className="text-xs text-gray-400">
          Fridays and Saturdays are unavailable. Choose a Sunday–Thursday.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shoutout-content">Shoutout Message</Label>
        <Textarea
          id="shoutout-content"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder="Write your promotional message here. Keep it concise and engaging — it will be included in our community newsletter."
          rows={5}
          maxLength={1000}
        />
        <p className="text-xs text-gray-400 text-right">{contentText.length}/1000</p>
      </div>

      <div className="space-y-2">
        <Label>Image (optional)</Label>
        <div className="flex items-center gap-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            id="shoutout-image-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ImageIcon className="h-4 w-4 mr-2" />
            )}
            {isUploadingImage ? "Uploading..." : imageUrl ? "Change Image" : "Add Image"}
          </Button>
          {selectedImageFile && imageUrl && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {selectedImageFile.name}
            </span>
          )}
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Shoutout preview"
            className="mt-2 h-28 w-auto rounded-lg border object-cover"
          />
        )}
        <p className="text-xs text-gray-400">Recommended: square or wide image, max 4MB</p>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !scheduledDate || !contentText.trim()}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Megaphone className="h-4 w-4 mr-2" />
        )}
        {existingShoutout?.status === "rejected" ? "Resubmit for Approval" : "Submit for Approval"}
      </Button>
    </div>
  );
}

interface ShoutoutSectionProps {
  businessId: number;
  initialShoutouts: Shoutout[];
}

export function ShoutoutSection({ businessId, initialShoutouts }: ShoutoutSectionProps) {
  const [shoutouts, setShoutouts] = useState<Shoutout[]>(initialShoutouts);
  const [showEditor, setShowEditor] = useState(false);

  // Find the most relevant shoutout
  const activeShoutout = shoutouts.find((s) =>
    ["pending_approval", "approved", "rejected"].includes(s.status)
  );
  const lastSentShoutout = shoutouts.find((s) => s.status === "sent");

  // Check 365-day cooldown from last sent
  let isCooledDown = true;
  if (lastSentShoutout) {
    const sentDate = new Date(lastSentShoutout.scheduledDate);
    const daysAgo = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
    isCooledDown = daysAgo >= 365;
  }

  const canSubmit = !activeShoutout && isCooledDown;

  function handleShoutoutSubmit(newShoutout: Shoutout) {
    setShoutouts((prev) => {
      // Replace or prepend
      const existing = prev.find((s) => s.id === newShoutout.id);
      if (existing) {
        return prev.map((s) => (s.id === newShoutout.id ? newShoutout : s));
      }
      return [newShoutout, ...prev];
    });
    setShowEditor(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending_approval":
        return <Badge className="bg-amber-100 text-amber-800">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-5 w-5" />
          Newsletter Shoutout
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            Elite Plan Feature
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          As an Elite subscriber, you get one newsletter shoutout per year. Your message will be
          featured at the top of our community newsletter on your chosen date.
        </p>

        {/* Current active shoutout status */}
        {activeShoutout && (
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium">
                Scheduled for {formatDate(activeShoutout.scheduledDate)}
              </span>
              {getStatusBadge(activeShoutout.status)}
            </div>

            {activeShoutout.status === "pending_approval" && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Clock className="h-3.5 w-3.5" />
                Awaiting admin approval
              </div>
            )}

            {activeShoutout.status === "approved" && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Approved — will go out on {formatDate(activeShoutout.scheduledDate)}
              </div>
            )}

            {activeShoutout.status === "rejected" && (
              <div className="space-y-2">
                {activeShoutout.rejectionReason && (
                  <p className="text-xs text-red-600">
                    Rejection reason: {activeShoutout.rejectionReason}
                  </p>
                )}
                {!showEditor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEditor(true)}
                  >
                    Revise & Resubmit
                  </Button>
                )}
              </div>
            )}

            {showEditor && activeShoutout.status === "rejected" && (
              <div className="pt-2 border-t">
                <ShoutoutEditor
                  businessId={businessId}
                  existingShoutout={activeShoutout}
                  onSubmit={handleShoutoutSubmit}
                />
              </div>
            )}
          </div>
        )}

        {/* Last sent shoutout info */}
        {lastSentShoutout && (
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
            Last shoutout sent on {formatDate(lastSentShoutout.scheduledDate)}
            {!isCooledDown && " — next available after 365-day cooldown"}
          </div>
        )}

        {/* New shoutout CTA */}
        {canSubmit && !showEditor && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowEditor(true)}
            className="w-full sm:w-auto"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Schedule a Shoutout
          </Button>
        )}

        {canSubmit && showEditor && (
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">New Newsletter Shoutout</h4>
            <ShoutoutEditor
              businessId={businessId}
              existingShoutout={null}
              onSubmit={handleShoutoutSubmit}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setShowEditor(false)}
            >
              Cancel
            </Button>
          </div>
        )}

        {!canSubmit && !activeShoutout && !isCooledDown && (
          <p className="text-sm text-gray-500">
            You have used your annual shoutout. A new shoutout will be available after the 365-day cooldown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
