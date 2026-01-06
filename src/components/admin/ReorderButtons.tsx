"use client";

import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";

interface ReorderButtonsProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isLoading?: boolean;
  size?: "sm" | "default";
}

export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isLoading = false,
  size = "sm",
}: ReorderButtonsProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0.5">
        <Loader2 className={`${iconSize} animate-spin text-gray-400`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        disabled={!canMoveUp}
        title="Move up"
      >
        <ChevronUp className={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        disabled={!canMoveDown}
        title="Move down"
      >
        <ChevronDown className={iconSize} />
      </Button>
    </div>
  );
}
