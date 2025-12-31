"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, MapPin, Clock } from "lucide-react";
import { EVENT_TYPES } from "@/lib/validations/content";
import type { CalendarEvent } from "@/types/content";

interface EventTableProps {
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getEventTypeLabel(type: string | null): string {
  return EVENT_TYPES.find((t) => t.value === type)?.label || type || "General";
}

function isPastEvent(date: Date | string): boolean {
  return new Date(date) < new Date();
}

export function EventTable({ events, onEdit, onDelete }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No events found. Create your first event to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isPast = isPastEvent(event.startTime);
              return (
                <TableRow
                  key={event.id}
                  className={isPast ? "opacity-60" : ""}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{event.title}</p>
                      {event.shulName && (
                        <p className="text-sm text-gray-500">{event.shulName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-gray-400" />
                      <div>
                        <p className="text-sm">{formatDate(event.startTime)}</p>
                        {!event.isAllDay && (
                          <p className="text-xs text-gray-500">
                            {formatTime(event.startTime)}
                            {event.endTime && ` - ${formatTime(event.endTime)}`}
                          </p>
                        )}
                        {event.isAllDay && (
                          <p className="text-xs text-gray-500">All Day</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getEventTypeLabel(event.eventType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {event.location ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">
                          {event.location}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isPast ? (
                      <Badge variant="outline" className="text-gray-500">
                        Past
                      </Badge>
                    ) : event.approvalStatus === "approved" ? (
                      <Badge className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {event.approvalStatus}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(event)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDelete(event)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {events.map((event) => {
          const isPast = isPastEvent(event.startTime);
          return (
            <div
              key={event.id}
              className={`bg-white rounded-lg shadow p-4 ${isPast ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-gray-900">{event.title}</p>
                  {event.shulName && (
                    <p className="text-sm text-gray-500">{event.shulName}</p>
                  )}
                </div>
                {isPast ? (
                  <Badge variant="outline" className="text-gray-500">Past</Badge>
                ) : event.approvalStatus === "approved" ? (
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                ) : (
                  <Badge variant="secondary">{event.approvalStatus}</Badge>
                )}
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <span>{formatDate(event.startTime)}</span>
                    {!event.isAllDay && (
                      <span className="text-gray-500 ml-2">
                        {formatTime(event.startTime)}
                        {event.endTime && ` - ${formatTime(event.endTime)}`}
                      </span>
                    )}
                    {event.isAllDay && (
                      <span className="text-gray-500 ml-2">All Day</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Type:</span>
                  <Badge variant="secondary">
                    {getEventTypeLabel(event.eventType)}
                  </Badge>
                </div>

                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{event.location}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(event)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => onDelete(event)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
