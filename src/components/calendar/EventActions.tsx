"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarPlus, Share2, Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EventActionsProps {
  event: {
    id: number;
    title: string;
    description: string | null;
    location: string | null;
    startTime: Date;
    endTime: Date | null;
    isAllDay: boolean | null;
  };
}

function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d{3}/g, "");
}

function formatDateForICS(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d{3}/g, "").slice(0, -1) + "Z";
}

function generateGoogleCalendarUrl(event: EventActionsProps["event"]): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", event.title);

  if (event.isAllDay) {
    // For all-day events, use date format without time
    const startDate = new Date(event.startTime);
    const dateStr = startDate.toISOString().split("T")[0].replace(/-/g, "");
    params.set("dates", `${dateStr}/${dateStr}`);
  } else {
    const start = formatDateForGoogle(new Date(event.startTime));
    const end = event.endTime
      ? formatDateForGoogle(new Date(event.endTime))
      : formatDateForGoogle(new Date(new Date(event.startTime).getTime() + 2 * 60 * 60 * 1000)); // Default 2 hours
    params.set("dates", `${start}/${end}`);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  if (event.description) {
    params.set("details", event.description.slice(0, 1000));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateICSFile(event: EventActionsProps["event"]): string {
  const start = formatDateForICS(new Date(event.startTime));
  const end = event.endTime
    ? formatDateForICS(new Date(event.endTime))
    : formatDateForICS(new Date(new Date(event.startTime).getTime() + 2 * 60 * 60 * 1000));

  const description = event.description?.replace(/\n/g, "\\n").slice(0, 1000) || "";
  const location = event.location || "";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FrumToronto//Events//EN",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `UID:event-${event.id}@frumtoronto.com`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return ics;
}

function downloadICS(event: EventActionsProps["event"]) {
  const ics = generateICSFile(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function EventActions({ event }: EventActionsProps) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://frumtoronto.com/community/calendar/${event.id}`;

  async function handleShare() {
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url: eventUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to copy
      }
    }

    // Fall back to copy link
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  }

  function openGoogleCalendar() {
    window.open(generateGoogleCalendarUrl(event), "_blank");
  }

  function handleDownloadICS() {
    downloadICS(event);
    toast.success("Calendar file downloaded!");
  }

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <CalendarPlus className="h-4 w-4 mr-2" />
            Add to Calendar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openGoogleCalendar}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Google Calendar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadICS}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Download .ics file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mobile add to calendar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="sm:hidden">
            <CalendarPlus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openGoogleCalendar}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Google Calendar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadICS}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Download .ics
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" onClick={handleShare}>
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
