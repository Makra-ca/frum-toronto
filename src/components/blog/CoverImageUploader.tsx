"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";
import { ImageIcon, X, Loader2, Upload, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoverImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

// Canvas dimensions for the cropped output
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 675; // 16:9

export function CoverImageUploader({
  value,
  onChange,
  disabled = false,
}: CoverImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [verticalPosition, setVerticalPosition] = useState(50); // 0–100%
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Clean up object URL when cropImage changes
  const cropObjectUrl = useRef<string | null>(null);

  const clearCropState = useCallback(() => {
    if (cropObjectUrl.current) {
      URL.revokeObjectURL(cropObjectUrl.current);
      cropObjectUrl.current = null;
    }
    setCropImage(null);
    setCropFile(null);
    setVerticalPosition(50);
  }, []);

  useEffect(() => {
    return () => {
      if (cropObjectUrl.current) {
        URL.revokeObjectURL(cropObjectUrl.current);
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or WebP image");
      e.target.value = "";
      return;
    }

    // Validate size (30MB max)
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Maximum file size is 30MB");
      e.target.value = "";
      return;
    }

    // Load into an <img> for the crop preview
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrl.current = objectUrl;

    const img = new Image();
    img.onload = () => {
      setCropFile(file);
      setCropImage(img);
      setVerticalPosition(50);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Failed to load image");
    };
    img.src = objectUrl;

    // Reset the input so the same file can be re-selected if needed
    e.target.value = "";
  };

  const cropAndUpload = async () => {
    if (!cropImage || !cropFile) return;

    setIsUploading(true);
    try {
      // Draw the 16:9 center-crop (adjusted by verticalPosition) onto a canvas
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      const imgAspect = cropImage.naturalWidth / cropImage.naturalHeight;
      const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;

      let srcX = 0;
      let srcY = 0;
      let srcW = cropImage.naturalWidth;
      let srcH = cropImage.naturalHeight;

      if (imgAspect > targetAspect) {
        // Image is wider than 16:9 — crop width
        srcH = cropImage.naturalHeight;
        srcW = cropImage.naturalHeight * targetAspect;
        srcX = (cropImage.naturalWidth - srcW) / 2;
        srcY = 0;
      } else {
        // Image is taller than 16:9 — crop height, adjustable by verticalPosition
        srcW = cropImage.naturalWidth;
        srcH = cropImage.naturalWidth / targetAspect;
        srcX = 0;
        const maxSrcY = cropImage.naturalHeight - srcH;
        srcY = (verticalPosition / 100) * maxSrcY;
      }

      ctx.drawImage(cropImage, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.92
        );
      });

      const croppedFile = new File([blob], "cover.jpg", { type: "image/jpeg" });

      const data = await uploadFile(croppedFile, "blog-covers");
      onChange(data.url);
      clearCropState();
      toast.success("Cover image uploaded");
    } catch {
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // ── Crop preview UI ──────────────────────────────────────────────────────────
  if (cropImage && cropObjectUrl.current) {
    const imgAspect = cropImage.naturalWidth / cropImage.naturalHeight;
    const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT; // 16:9

    // Determine if the slider is relevant (image taller than 16:9)
    const showSlider = imgAspect <= targetAspect;

    // object-position for the preview (horizontal always 50%, vertical adjustable)
    const objectPosition = showSlider ? `50% ${verticalPosition}%` : "50% 50%";

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Crop your cover image
        </p>
        <p className="text-xs text-gray-500">
          This is how your cover will appear (16:9 ratio).
          {showSlider && " Drag the slider to adjust the vertical position."}
        </p>

        {/* 16:9 preview box */}
        <div
          ref={previewRef}
          className="relative w-full overflow-hidden rounded-lg border border-gray-200"
          style={{ aspectRatio: "16 / 9" }}
        >
          <img
            src={cropObjectUrl.current}
            alt="Crop preview"
            className="w-full h-full"
            style={{ objectFit: "cover", objectPosition }}
            draggable={false}
          />
          {/* 16:9 label overlay */}
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
            16:9 crop
          </div>
        </div>

        {/* Vertical position slider — only shown when image is taller than 16:9 */}
        {showSlider && (
          <div className="space-y-1">
            <label className="text-xs text-gray-500 flex justify-between">
              <span>Vertical position</span>
              <span>
                {verticalPosition === 0
                  ? "Top"
                  : verticalPosition === 100
                  ? "Bottom"
                  : verticalPosition === 50
                  ? "Center"
                  : verticalPosition < 50
                  ? `${verticalPosition}% from top`
                  : `${100 - verticalPosition}% from bottom`}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={verticalPosition}
              onChange={(e) => setVerticalPosition(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
              disabled={isUploading}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={cropAndUpload}
            disabled={isUploading || disabled}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Crop className="h-4 w-4 mr-2" />
                Use This Crop
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearCropState}
            disabled={isUploading || disabled}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Existing image preview ───────────────────────────────────────────────────
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
          Cropped to 16:9 (1200×675)
        </p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
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
                JPG, PNG, WebP — Max 30MB — auto-cropped to 16:9
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
        Output: 1200×675 (16:9)
      </p>
    </div>
  );
}
