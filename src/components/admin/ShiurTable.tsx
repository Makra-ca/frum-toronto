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
import { Pencil, Trash2, Clock, MapPin, Pause, Play } from "lucide-react";
import { SHIUR_CATEGORIES, SHIUR_LEVELS, SHIUR_GENDERS, DAYS_OF_WEEK } from "@/lib/validations/content";
import type { Shiur, ScheduleEntry } from "@/types/content";

interface ShiurTableProps {
  shiurim: Shiur[];
  onEdit: (shiur: Shiur) => void;
  onDelete: (shiur: Shiur) => void;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getCategoryLabel(category: string | null): string {
  return SHIUR_CATEGORIES.find((c) => c.value === category)?.label || category || "";
}

function getLevelLabel(level: string | null): string {
  return SHIUR_LEVELS.find((l) => l.value === level)?.label || level || "";
}

function getGenderLabel(gender: string | null): string {
  return SHIUR_GENDERS.find((g) => g.value === gender)?.label || gender || "";
}

function getScheduleSummary(schedule: Record<string, ScheduleEntry> | null): string {
  if (!schedule) return "-";

  const activeDays = DAYS_OF_WEEK.filter(day => {
    const entry = schedule[day.value.toString()];
    return entry?.start;
  });

  if (activeDays.length === 0) return "-";
  if (activeDays.length === 7) return "Daily";
  if (activeDays.length === 1) return activeDays[0].label;

  return activeDays.map(d => d.label.slice(0, 3)).join(", ");
}

function getFirstScheduleTime(schedule: Record<string, ScheduleEntry> | null): string | null {
  if (!schedule) return null;

  for (const day of DAYS_OF_WEEK) {
    const entry = schedule[day.value.toString()];
    if (entry?.start) {
      return formatTime(entry.start);
    }
  }
  return null;
}

export function ShiurTable({ shiurim, onEdit, onDelete }: ShiurTableProps) {
  if (shiurim.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No shiurim found. Create your first shiur to get started.
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
              <TableHead>Shiur</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiurim.map((shiur) => (
              <TableRow key={shiur.id} className={shiur.isOnHold ? "opacity-60" : ""}>
                <TableCell>
                  <div>
                    <p className="font-medium">{shiur.title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {shiur.level && (
                        <Badge variant="secondary" className="text-xs">
                          {getLevelLabel(shiur.level)}
                        </Badge>
                      )}
                      {shiur.gender && (
                        <Badge variant="outline" className="text-xs">
                          {getGenderLabel(shiur.gender)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{shiur.teacherName}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-1">
                    <Clock className="h-3 w-3 mt-1 text-gray-400" />
                    <div className="text-sm">
                      <p>{getScheduleSummary(shiur.schedule)}</p>
                      {getFirstScheduleTime(shiur.schedule) && (
                        <p className="text-gray-500 text-xs">
                          {getFirstScheduleTime(shiur.schedule)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {shiur.category && (
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryLabel(shiur.category)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {shiur.shulName || shiur.locationName ? (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">
                        {shiur.shulName || shiur.locationName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {shiur.isOnHold ? (
                    <Badge variant="outline" className="text-orange-600">
                      <Pause className="h-3 w-3 mr-1" />
                      On Hold
                    </Badge>
                  ) : shiur.isActive ? (
                    <Badge className="bg-green-100 text-green-800">
                      <Play className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(shiur)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(shiur)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {shiurim.map((shiur) => (
          <div
            key={shiur.id}
            className={`bg-white rounded-lg shadow p-4 ${shiur.isOnHold ? "opacity-60" : ""}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-gray-900">{shiur.title}</p>
                <p className="text-sm text-gray-500">{shiur.teacherName}</p>
              </div>
              {shiur.isOnHold ? (
                <Badge variant="outline" className="text-orange-600">
                  <Pause className="h-3 w-3 mr-1" />
                  On Hold
                </Badge>
              ) : shiur.isActive ? (
                <Badge className="bg-green-100 text-green-800">
                  <Play className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {shiur.level && (
                <Badge variant="secondary" className="text-xs">
                  {getLevelLabel(shiur.level)}
                </Badge>
              )}
              {shiur.gender && (
                <Badge variant="outline" className="text-xs">
                  {getGenderLabel(shiur.gender)}
                </Badge>
              )}
              {shiur.category && (
                <Badge variant="secondary" className="text-xs">
                  {getCategoryLabel(shiur.category)}
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{getScheduleSummary(shiur.schedule)}</span>
                {getFirstScheduleTime(shiur.schedule) && (
                  <span className="text-gray-500">
                    @ {getFirstScheduleTime(shiur.schedule)}
                  </span>
                )}
              </div>

              {(shiur.shulName || shiur.locationName) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    {shiur.shulName || shiur.locationName}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(shiur)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDelete(shiur)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
