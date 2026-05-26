"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, X, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoverImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function CoverImageUploader({
  value,
  onChange,
  disabled = false,
}: CoverImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or WebP image");
      e.target.value = "";
      return;
    }

    // Validate size (4MB max)
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be smaller than 4MB");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      toast.success("Cover image uploaded");
    } catch {
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (value) {
    return (
      <div className="relative group">
        <img
          src={value}
          alt="Cover preview"
          className="w-full aspect-video object-cover rounded-lg border border-gray-200"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Replace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Remove
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Best results: 1280×720 (16:9) or wider
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg transition-colors ${
          disabled || isUploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : "border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"
        }`}
      >
        <div className="flex flex-col items-center gap-2 text-gray-500">
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Click to upload cover image
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG, WebP — Max 4MB
              </span>
            </>
          )}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </label>
      <p className="text-xs text-gray-400 mt-1.5">
        Best results: 1280×720 (16:9) or wider
      </p>
    </div>
  );
}
