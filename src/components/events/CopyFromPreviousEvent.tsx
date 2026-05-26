"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface EventPrefillData {
  description: string | null;
  location: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organization: string | null;
  eventType: string | null;
}

interface RecentEvent {
  id: number;
  title: string;
  startTime: string;
  description: string | null;
  location: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organization: string | null;
  eventType: string | null;
}

interface CopyFromPreviousEventProps {
  onCopy: (data: EventPrefillData) => void;
}

function formatEventDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function CopyFromPreviousEvent({ onCopy }: CopyFromPreviousEventProps) {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await fetch("/api/events/my-recent");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  function handleSelect(value: string) {
    const event = events.find((e) => e.id.toString() === value);
    if (!event) return;
    onCopy({
      description: event.description,
      location: event.location,
      contactName: event.contactName,
      contactEmail: event.contactEmail,
      contactPhone: event.contactPhone,
      organization: event.organization,
      eventType: event.eventType,
    });
  }

  if (loading || events.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
      <Label className="text-sm font-medium text-blue-800">
        Auto-fill from previous event
      </Label>
      <p className="text-xs text-blue-600">
        Select a previous event to pre-fill the description, location, contact,
        and organization fields.
      </p>
      <Select onValueChange={handleSelect}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Choose a previous event..." />
        </SelectTrigger>
        <SelectContent>
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id.toString()}>
              {event.title}
              {event.startTime
                ? ` — ${formatEventDate(event.startTime)}`
                : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
