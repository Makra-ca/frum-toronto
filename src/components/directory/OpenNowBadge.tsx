"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { isBusinessOpenNow, getTodayHours, formatHoursDisplay } from "@/lib/directory/utils";

interface OpenNowBadgeProps {
  hours: unknown;
  showHours?: boolean;
  variant?: "default" | "light";
}

export function OpenNowBadge({ hours, showHours = false, variant = "default" }: OpenNowBadgeProps) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [todayHours, setTodayHours] = useState<{ open: string; close: string } | null>(null);

  useEffect(() => {
    // Calculate on client to ensure correct timezone
    setIsOpen(isBusinessOpenNow(hours));
    setTodayHours(getTodayHours(hours));

    // Update every minute
    const interval = setInterval(() => {
      setIsOpen(isBusinessOpenNow(hours));
    }, 60000);

    return () => clearInterval(interval);
  }, [hours]);

  if (isOpen === null) {
    // Still loading (SSR/hydration)
    return null;
  }

  const isLightVariant = variant === "light";

  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1">
        <Badge
          variant="secondary"
          className={
            isLightVariant
              ? "bg-green-500/20 text-green-200 text-xs"
              : "bg-green-100 text-green-800 text-xs"
          }
        >
          Open Now
        </Badge>
        {showHours && todayHours && (
          <span className={`text-xs ${isLightVariant ? "text-blue-200" : "text-gray-500"}`}>
            until {todayHours.close}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="secondary"
        className={
          isLightVariant
            ? "bg-white/20 text-blue-200 text-xs"
            : "bg-gray-100 text-gray-600 text-xs"
        }
      >
        Closed
      </Badge>
      {showHours && todayHours && (
        <span className={`text-xs ${isLightVariant ? "text-blue-200" : "text-gray-500"}`}>
          Opens {todayHours.open}
        </span>
      )}
    </span>
  );
}
