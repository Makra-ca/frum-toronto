"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { specialSchema, type SpecialFormData } from "@/lib/validations/specials";

interface Business {
  id: number;
  name: string;
}

interface CanSubmitResponse {
  canSubmit: boolean;
  reason?: string;
  businesses?: Business[];
}

export function SpecialSubmitModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<CanSubmitResponse | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [uploadedFileType, setUploadedFileType] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SpecialFormData>({
    resolver: zodResolver(specialSchema),
    defaultValues: {
      title: "",
      description: "",
      fileUrl: "",
      fileType: "jpg",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  });

  const selectedBusinessId = watch("businessId");

  // Check permission when modal opens
  useEffect(() => {
    if (isOpen && !permission) {
      checkPermission();
    }
  }, [isOpen]);

  async function checkPermission() {
    setIsCheckingPermission(true);
    try {
      const response = await fetch("/api/specials/can-submit");
      const data = await response.json();
      setPermission(data);
    } catch (error) {
      console.error("Error checking permission:", error);
      setPermission({ canSubmit: false, reason: "error" });
    } finally {
      setIsCheckingPermission(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, PNG, or JPG file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setUploadedFileUrl(data.url);

      // Determine file type
      let fileType: "pdf" | "png" | "jpg" | "jpeg" = "jpg";
      if (file.type === "application/pdf") fileType = "pdf";
      else if (file.type === "image/png") fileType = "png";
      else if (file.type === "image/jpeg") fileType = "jpg";

      setUploadedFileType(fileType);
      setValue("fileUrl", data.url);
      setValue("fileType", fileType);

      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(data: SpecialFormData) {
    if (!uploadedFileUrl) {
      toast.error("Please upload a flyer file");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/specials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fileUrl: uploadedFileUrl,
          fileType: uploadedFileType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit special");
      }

      toast.success("Special submitted successfully! It will be visible after approval.");
      setIsOpen(false);
      reset();
      setUploadedFileUrl("");
      setUploadedFileType("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit special");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      reset();
      setUploadedFileUrl("");
      setUploadedFileType("");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-white text-orange-600 hover:bg-orange-50">
          <Plus className="h-4 w-4 mr-2" />
          Submit Special
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Special/Flyer</DialogTitle>
        </DialogHeader>

        {isCheckingPermission ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !permission?.canSubmit ? (
          <div className="py-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">
              {permission?.reason === "not_authenticated"
                ? "Login Required"
                : "Verification Required"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {permission?.reason === "not_authenticated"
                ? "Please log in to submit specials."
                : "Only verified businesses can post specials. Contact admin to become a verified business."}
            </p>
            {permission?.reason === "not_authenticated" && (
              <Button variant="outline" onClick={() => window.location.href = "/login"}>
                Log In
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Business Select */}
            <div className="space-y-2">
              <Label htmlFor="businessId">Business *</Label>
              <Select
                value={selectedBusinessId?.toString() || ""}
                onValueChange={(value) => setValue("businessId", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a business" />
                </SelectTrigger>
                <SelectContent>
                  {permission.businesses?.map((business) => (
                    <SelectItem key={business.id} value={business.id.toString()}>
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.businessId && (
                <p className="text-sm text-red-500">{errors.businessId.message}</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Weekly Flyer Feb 20-27"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the specials..."
                rows={2}
                {...register("description")}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Flyer File (PDF, PNG, or JPG) *</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                {uploadedFileUrl ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                        {uploadedFileType === "pdf" ? (
                          <span className="text-xs font-medium text-orange-600">PDF</span>
                        ) : (
                          <span className="text-xs font-medium text-orange-600">IMG</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">File uploaded</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUploadedFileUrl("");
                        setUploadedFileType("");
                        setValue("fileUrl", "");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    ) : (
                      <Upload className="h-8 w-8 text-gray-400" />
                    )}
                    <span className="mt-2 text-sm text-gray-500">
                      {isUploading ? "Uploading..." : "Click to upload flyer"}
                    </span>
                    <span className="text-xs text-gray-400">PDF, PNG, JPG up to 10MB</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
              {errors.fileUrl && (
                <p className="text-sm text-red-500">{errors.fileUrl.message}</p>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Valid From *</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate")}
                />
                {errors.startDate && (
                  <p className="text-sm text-red-500">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Valid Until *</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register("endDate")}
                />
                {errors.endDate && (
                  <p className="text-sm text-red-500">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !uploadedFileUrl}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Special"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
