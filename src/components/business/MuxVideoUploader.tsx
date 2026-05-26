"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Video,
  AlertCircle,
} from "lucide-react";

interface MuxVideoUploaderProps {
  businessId: number;
  videoStatus: string;
  videoApprovalStatus: string;
  videoRejectionReason: string | null;
  muxPlaybackId: string | null;
  onStatusChange: (update: {
    videoStatus: string;
    videoApprovalStatus: string;
    videoRejectionReason: string | null;
    muxPlaybackId: string | null;
  }) => void;
}

export function MuxVideoUploader({
  businessId,
  videoStatus: initialVideoStatus,
  videoApprovalStatus: initialApprovalStatus,
  videoRejectionReason: initialRejectionReason,
  muxPlaybackId: initialPlaybackId,
  onStatusChange,
}: MuxVideoUploaderProps) {
  const [videoStatus, setVideoStatus] = useState(initialVideoStatus);
  const [videoApprovalStatus, setVideoApprovalStatus] = useState(initialApprovalStatus);
  const [videoRejectionReason] = useState(initialRejectionReason);
  const [muxPlaybackId] = useState(initialPlaybackId);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get the MUX direct upload URL
      const createRes = await fetch(`/api/businesses/${businessId}/video`, {
        method: "POST",
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to create upload");
      }

      const { uploadUrl, uploadId } = await createRes.json();

      // Step 2: Upload the file directly to MUX via PUT
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload was aborted")));

        xhr.open("PUT", uploadUrl);
        xhr.send(file);
      });

      // Step 3: Confirm upload completion
      const confirmedRes = await fetch(`/api/businesses/${businessId}/video/uploaded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });

      if (!confirmedRes.ok) {
        const data = await confirmedRes.json();
        throw new Error(data.error || "Failed to confirm upload");
      }

      const newStatus = "uploading";
      const newApprovalStatus = "pending";
      setVideoStatus(newStatus);
      setVideoApprovalStatus(newApprovalStatus);
      onStatusChange({
        videoStatus: newStatus,
        videoApprovalStatus: newApprovalStatus,
        videoRejectionReason: null,
        muxPlaybackId: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to remove this video? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/video`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete video");
      }

      setVideoStatus("none");
      setVideoApprovalStatus("pending");
      onStatusChange({
        videoStatus: "none",
        videoApprovalStatus: "pending",
        videoRejectionReason: null,
        muxPlaybackId: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete video");
    } finally {
      setIsDeleting(false);
    }
  }

  function renderStatus() {
    if (isUploading) {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-gray-700">Uploading video...</p>
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">{uploadProgress}%</p>
        </div>
      );
    }

    if (videoStatus === "none" || videoStatus === "errored") {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          {videoStatus === "errored" && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
              <XCircle className="h-4 w-4" />
              <span>Previous upload failed. Please try again.</span>
            </div>
          )}
          <Video className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 text-center">
            Upload a short promotional video (MP4, MOV — up to 500MB recommended)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="video-upload-input"
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose Video File
          </Button>
        </div>
      );
    }

    if (videoStatus === "uploading" || videoStatus === "processing") {
      return (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              {videoStatus === "uploading" ? "Video upload in progress..." : "Video is being processed..."}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              This may take a few minutes. The page will update automatically.
            </p>
          </div>
        </div>
      );
    }

    if (videoStatus === "ready") {
      if (videoApprovalStatus === "pending") {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Video pending admin review</p>
                <p className="text-xs text-gray-500">
                  Your video has been uploaded and is awaiting approval before it goes live on your listing.
                </p>
              </div>
            </div>
            {muxPlaybackId && (
              <img
                src={`https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=1`}
                alt="Video thumbnail"
                className="w-40 h-24 object-cover rounded-lg border"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove Video
            </Button>
          </div>
        );
      }

      if (videoApprovalStatus === "approved") {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Video is live on your listing</p>
                <p className="text-xs text-gray-500">Your video is approved and visible to visitors.</p>
              </div>
            </div>
            {muxPlaybackId && (
              <div className="relative">
                <img
                  src={`https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=1`}
                  alt="Video thumbnail"
                  className="w-48 h-28 object-cover rounded-lg border"
                />
                <Badge className="absolute top-2 left-2 bg-green-500">Live</Badge>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove Video
            </Button>
          </div>
        );
      }

      if (videoApprovalStatus === "rejected") {
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-800">Video was not approved</p>
                {videoRejectionReason && (
                  <p className="text-xs text-red-600 mt-0.5">Reason: {videoRejectionReason}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  You can remove this video and upload a new one.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Remove & Re-upload
              </Button>
            </div>
          </div>
        );
      }
    }

    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-5 w-5" />
          Promotional Video
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            Elite Plan Feature
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {renderStatus()}
      </CardContent>
    </Card>
  );
}
