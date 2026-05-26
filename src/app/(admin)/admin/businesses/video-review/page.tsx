"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Play, ExternalLink, Loader2, Video } from "lucide-react";
import { toast } from "sonner";

interface VideoReviewBusiness {
  id: number;
  name: string;
  slug: string;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  videoStatus: string;
  videoApprovalStatus: string;
  videoRejectionReason: string | null;
  categoryName: string | null;
  updatedAt: string;
}

function VideoCard({
  business,
  onApprove,
  onReject,
}: {
  business: VideoReviewBusiness;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, reason: string) => Promise<void>;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await onApprove(business.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await onReject(business.id, rejectionReason);
    } finally {
      setSubmitting(false);
      setRejectMode(false);
      setRejectionReason("");
    }
  }

  const submittedDate = new Date(business.updatedAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const muxThumbnail = business.muxPlaybackId
    ? `https://image.mux.com/${business.muxPlaybackId}/thumbnail.png?width=640&height=360&fit_mode=smartcrop`
    : null;

  const muxStreamUrl = business.muxPlaybackId
    ? `https://stream.mux.com/${business.muxPlaybackId}`
    : null;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Video thumbnail */}
      <div className="relative bg-gray-900 aspect-video">
        {muxThumbnail ? (
          <>
            <img
              src={muxThumbnail}
              alt={`Video thumbnail for ${business.name}`}
              className="w-full h-full object-cover opacity-90"
            />
            {muxStreamUrl && (
              <a
                href={muxStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                  <Play className="h-6 w-6 text-white ml-1" fill="white" />
                </div>
              </a>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-10 w-10 text-gray-600" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{business.name}</h3>
            {business.categoryName && (
              <p className="text-xs text-gray-500 mt-0.5">{business.categoryName}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Uploaded {submittedDate}</p>
          </div>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 shrink-0">
            Pending Review
          </Badge>
        </div>

        {muxStreamUrl && (
          <a
            href={muxStreamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            Open in player
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        <div className="pt-1 space-y-3">
          {rejectMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Rejection reason <span className="text-gray-400">(optional)</span>
              </label>
              <Textarea
                placeholder="Explain why the video was not approved..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Confirm Rejection
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRejectMode(false);
                    setRejectionReason("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setRejectMode(true)}
                disabled={submitting}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VideoReviewPage() {
  const [items, setItems] = useState<VideoReviewBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchItems() {
    try {
      const res = await fetch("/api/admin/businesses/video-review");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Failed to load video review queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function handleApprove(id: number) {
    const res = await fetch(`/api/admin/businesses/${id}/video/approve`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to approve video");
    }

    toast.success("Video approved and is now live");
    setItems((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleReject(id: number, reason: string) {
    const res = await fetch(`/api/admin/businesses/${id}/video/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reject video");
    }

    toast.success("Video rejected and removed");
    setItems((prev) => prev.filter((b) => b.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed rounded-lg py-16 text-center">
        <CheckCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No videos pending review</p>
        <p className="text-gray-400 text-xs mt-1">
          Videos appear here when a business uploads a video and it finishes processing
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {items.length} video{items.length !== 1 ? "s" : ""} awaiting review. Watch each video before approving.
      </p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <VideoCard
            key={item.id}
            business={item}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>
    </div>
  );
}
