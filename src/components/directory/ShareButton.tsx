"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy } from "lucide-react";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  variant?: "default" | "icon";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ShareButton({
  title,
  text,
  url,
  variant = "default",
  size = "sm",
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const shareData = {
      title,
      text,
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error - silently ignore
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback failed - silently ignore
      }
    }
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size={size}
        className={className}
        onClick={handleShare}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </>
      )}
    </Button>
  );
}
