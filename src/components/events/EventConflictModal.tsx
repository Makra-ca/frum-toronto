"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface ConflictingEvent {
  id: number;
  title: string;
  startTime: string;
  contactName: string | null;
  organization: string | null;
}

interface EventConflictModalProps {
  conflicts: ConflictingEvent[];
  onCancel: () => void;
  onProceed: () => void;
}

function formatConflictTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function EventConflictModal({
  conflicts,
  onCancel,
  onProceed,
}: EventConflictModalProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            Scheduling Conflict Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-600">
            {conflicts.length === 1
              ? "There is already an approved event scheduled on this date:"
              : `There are already ${conflicts.length} approved events scheduled on this date:`}
          </p>
          <ul className="space-y-2">
            {conflicts.map((event) => (
              <li
                key={event.id}
                className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
              >
                <p className="text-sm font-medium text-gray-900 leading-snug">
                  {event.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatConflictTime(event.startTime)}
                </p>
                {(event.organization || event.contactName) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {event.organization || event.contactName}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-600">
            You can cancel to choose a different date, or schedule anyway. If
            you proceed, the organizers of the conflicting events will be
            notified by email.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onProceed}
          >
            Schedule Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
