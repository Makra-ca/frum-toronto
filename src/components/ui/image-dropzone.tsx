"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ImageDropzoneProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "banner";
  disabled?: boolean;
}

export function ImageDropzone({
  value,
  onChange,
  folder = "general",
  className,
  aspectRatio = "banner",
  disabled = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    banner: "aspect-[2/1]",
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Please use JPEG, PNG, WebP, or GIF.");
      }

      // Validate file size (4MB max)
      if (file.size > 4 * 1024 * 1024) {
        throw new Error("File is too large. Maximum size is 4MB.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [disabled, isUploading, uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [uploadFile]);

  const handleRemove = useCallback(async () => {
    if (!value) return;

    try {
      // Optionally delete from blob storage
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
    } catch (err) {
      // Ignore delete errors - the image might not exist anymore
      console.error("Error deleting image:", err);
    }

    onChange(null);
  }, [value, onChange]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
          aspectClasses[aspectRatio],
          isDragging && "border-blue-500 bg-blue-50",
          !isDragging && !value && "border-gray-300 hover:border-gray-400 bg-gray-50",
          value && "border-gray-200",
          (disabled || isUploading) && "cursor-not-allowed opacity-60",
          error && "border-red-300 bg-red-50"
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Show uploaded image */}
        {value && !isUploading && (
          <>
            <img
              src={value}
              alt="Uploaded"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Click to replace</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Upload UI when no image */}
        {!value && !isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="rounded-full bg-gray-100 p-3 mb-3">
              {isDragging ? (
                <Upload className="h-6 w-6 text-blue-500" />
              ) : (
                <ImageIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? "Drop image here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPEG, PNG, WebP, or GIF (max 4MB)
            </p>
          </div>
        )}

        {/* Loading state */}
        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
