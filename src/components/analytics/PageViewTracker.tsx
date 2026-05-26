"use client";

import { usePageView } from "@/hooks/usePageView";

interface Props {
  entityType?: string;
  entityId?: number | string;
}

export function PageViewTracker({ entityType, entityId }: Props) {
  usePageView({ entityType, entityId });
  return null;
}
