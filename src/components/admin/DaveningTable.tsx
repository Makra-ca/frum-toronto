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
import { Pencil, Trash2 } from "lucide-react";
import { DAYS_OF_WEEK, TEFILAH_TYPES } from "@/lib/validations/content";

interface DaveningSchedule {
  id: number;
  shulId: number | null;
  tefilahType: string | null;
  dayOfWeek: number | null;
  time: string;
  notes: string | null;
  isWinter: boolean | null;
  isSummer: boolean | null;
  isShabbos: boolean | null;
}

interface DaveningTableProps {
  schedules: DaveningSchedule[];
  onEdit: (schedule: DaveningSchedule) => void;
  onDelete: (schedule: DaveningSchedule) => void;
}

function formatTime(time: string): string {
  // Convert 24h format to 12h format with AM/PM
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getTefilahLabel(type: string | null): string {
  return TEFILAH_TYPES.find((t) => t.value === type)?.label || type || "Unknown";
}

function getDayLabel(day: number | null): string {
  if (day === null) return "Daily";
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
}

export function DaveningTable({ schedules, onEdit, onDelete }: DaveningTableProps) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No davening schedules found. Add your first schedule to get started.
        </p>
      </div>
    );
  }

  // Group schedules by tefilah type
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const type = schedule.tefilahType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(schedule);
    return acc;
  }, {} as Record<string, DaveningSchedule[]>);

  // Sort order for tefilah types
  const typeOrder = ["shacharis", "mincha", "maariv", "other"];

  return (
    <div className="space-y-6">
      {typeOrder
        .filter((type) => groupedSchedules[type]?.length > 0)
        .map((type) => (
          <div key={type}>
            <div className="bg-gray-50 px-4 py-2 border rounded-t-md">
              <h3 className="font-semibold capitalize">
                {getTefilahLabel(type)}
              </h3>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-b-md border border-t-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedSchedules[type].map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {getDayLabel(schedule.dayOfWeek)}
                        </Badge>
                        {schedule.isShabbos && (
                          <Badge className="ml-2 bg-purple-100 text-purple-800">
                            Shabbos
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatTime(schedule.time)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {schedule.isWinter && (
                            <Badge variant="secondary" className="text-xs">
                              Winter
                            </Badge>
                          )}
                          {schedule.isSummer && (
                            <Badge variant="secondary" className="text-xs">
                              Summer
                            </Badge>
                          )}
                          {!schedule.isWinter && !schedule.isSummer && (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {schedule.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(schedule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => onDelete(schedule)}
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
            <div className="md:hidden space-y-2 border border-t-0 rounded-b-md p-2">
              {groupedSchedules[type].map((schedule) => (
                <div
                  key={schedule.id}
                  className="bg-white rounded-lg border p-3"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {getDayLabel(schedule.dayOfWeek)}
                      </Badge>
                      {schedule.isShabbos && (
                        <Badge className="bg-purple-100 text-purple-800">
                          Shabbos
                        </Badge>
                      )}
                    </div>
                    <span className="font-medium">{formatTime(schedule.time)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {schedule.isWinter && (
                      <Badge variant="secondary" className="text-xs">
                        Winter
                      </Badge>
                    )}
                    {schedule.isSummer && (
                      <Badge variant="secondary" className="text-xs">
                        Summer
                      </Badge>
                    )}
                  </div>

                  {schedule.notes && (
                    <p className="text-sm text-gray-500 mb-3">{schedule.notes}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onEdit(schedule)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(schedule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
