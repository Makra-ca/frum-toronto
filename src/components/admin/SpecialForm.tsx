"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { adminSpecialSchema, type AdminSpecialFormData } from "@/lib/validations/specials";

interface Business {
  id: number;
  name: string;
}

interface SpecialFormProps {
  initialData?: {
    id?: number;
    businessId: number | null;
    title: string;
    description: string | null;
    fileUrl: string;
    fileType: string;
    startDate: string;
    endDate: string;
    approvalStatus?: string;
    isActive?: boolean;
  };
  onSubmit: (data: AdminSpecialFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SpecialForm({ initialData, onSubmit, onCancel, isLoading }: SpecialFormProps) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(initialData?.fileUrl || "");
  const [uploadedFileType, setUploadedFileType] = useState<string>(initialData?.fileType || "");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminSpecialFormData>({
    resolver: zodResolver(adminSpecialSchema),
    defaultValues: {
      businessId: initialData?.businessId || undefined,
      title: initialData?.title || "",
      description: initialData?.description || "",
      fileUrl: initialData?.fileUrl || "",
      fileType: (initialData?.fileType as "pdf" | "png" | "jpg" | "jpeg") || "jpg",
      startDate: initialData?.startDate || new Date().toISOString().split("T")[0],
      endDate: initialData?.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      approvalStatus: (initialData?.approvalStatus as "pending" | "approved" | "rejected") || "approved",
      isActive: initialData?.isActive ?? true,
    },
  });

  const selectedBusinessId = watch("businessId");
  const approvalStatus = watch("approvalStatus");
  const isActive = watch("isActive");

  useEffect(() => {
    async function fetchBusinesses() {
      try {
        const response = await fetch("/api/admin/businesses?status=approved&limit=1000");
        if (response.ok) {
          const data = await response.json();
          setBusinesses(data.businesses || []);
        }
      } catch (error) {
        console.error("Error fetching businesses:", error);
      }
    }
    fetchBusinesses();
  }, []);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, PNG, or JPG file");
      return;
    }

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

  async function onFormSubmit(data: AdminSpecialFormData) {
    if (!uploadedFileUrl) {
      toast.error("Please upload a flyer file");
      return;
    }

    await onSubmit({
      ...data,
      fileUrl: uploadedFileUrl,
      fileType: uploadedFileType as "pdf" | "png" | "jpg" | "jpeg",
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
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
            {businesses.map((business) => (
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
                  <span className="text-xs font-medium text-orange-600">
                    {uploadedFileType.toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-gray-600 truncate max-w-[200px]">
                  {uploadedFileUrl.split("/").pop()}
                </span>
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
          <Input id="startDate" type="date" {...register("startDate")} />
          {errors.startDate && (
            <p className="text-sm text-red-500">{errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Valid Until *</Label>
          <Input id="endDate" type="date" {...register("endDate")} />
          {errors.endDate && (
            <p className="text-sm text-red-500">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {/* Admin Fields */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="space-y-2">
          <Label>Approval Status</Label>
          <Select
            value={approvalStatus || "approved"}
            onValueChange={(value) => setValue("approvalStatus", value as "pending" | "approved" | "rejected")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Active</Label>
          <div className="flex items-center h-10">
            <Switch
              checked={isActive ?? true}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !uploadedFileUrl}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : initialData ? (
            "Update Special"
          ) : (
            "Create Special"
          )}
        </Button>
      </div>
    </form>
  );
}
