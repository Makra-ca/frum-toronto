"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

interface NonProfitApplicationFormProps {
  businessId: number;
  nonProfitStatus: string;
  nonProfitRejectionReason: string | null;
  isNonProfit: boolean;
  onStatusChange: (update: {
    nonProfitStatus: string;
    isNonProfit: boolean;
    nonProfitRejectionReason: string | null;
  }) => void;
}

export function NonProfitApplicationForm({
  businessId,
  nonProfitStatus: initialStatus,
  nonProfitRejectionReason: initialRejectionReason,
  isNonProfit: initialIsNonProfit,
  onStatusChange,
}: NonProfitApplicationFormProps) {
  const [nonProfitStatus, setNonProfitStatus] = useState(initialStatus);
  const [isNonProfit] = useState(initialIsNonProfit);
  const [rejectionReason] = useState(initialRejectionReason);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Already verified — show badge only
  if (isNonProfit && nonProfitStatus === "verified") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            Non-Profit Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-600 text-white">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified Non-Profit
            </Badge>
            <p className="text-sm text-gray-600">
              Your non-profit status is verified. You may be eligible for discounted subscription rates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending review
  if (nonProfitStatus === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Non-Profit Discount
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Application pending review</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Your non-profit verification document has been submitted and is awaiting admin review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show form for none or rejected
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadedUrl(null);
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "non-profit-docs");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "File upload failed");
      }

      const { url } = await uploadRes.json();
      setUploadedUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit() {
    if (!uploadedUrl) {
      setError("Please upload a document first");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/non-profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl: uploadedUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      setNonProfitStatus("pending");
      onStatusChange({
        nonProfitStatus: "pending",
        isNonProfit: false,
        nonProfitRejectionReason: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" />
          Non-Profit Discount
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nonProfitStatus === "rejected" && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Previous application was rejected</p>
              {rejectionReason && (
                <p className="text-xs text-red-600 mt-0.5">Reason: {rejectionReason}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">You can reapply with updated documentation.</p>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600">
          Non-profit organizations may be eligible for discounted subscription rates.
          Upload your charity registration document (e.g., CRA charitable registration) to apply.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label>Charity Registration Document</Label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              id="nonprofit-doc-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? "Uploading..." : "Choose File"}
            </Button>
            {selectedFile && (
              <span className="text-sm text-gray-600 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gray-400" />
                {selectedFile.name}
                {uploadedUrl && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Accepted formats: PDF, JPG, PNG — Max 10MB
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!uploadedUrl || isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Submit Application
        </Button>
      </CardContent>
    </Card>
  );
}
