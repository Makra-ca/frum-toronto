"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, MapPin, Clock, User, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAYS_OF_WEEK, SHIUR_LEVELS, SHIUR_GENDERS, SHIUR_CATEGORIES } from "@/lib/validations/content";

interface ScheduleEntry {
  start?: string;
  end?: string;
  notes?: string;
}

interface Shiur {
  id: number;
  teacherName: string;
  title: string;
  description: string | null;
  location: string | null;
  shulId: number | null;
  shulName: string | null;
  locationName: string | null;
  locationAddress: string | null;
  locationArea: string | null;
  schedule: Record<string, ScheduleEntry> | null;
  dayOfWeek: number | null;
  time: string | null;
  duration: number | null;
  category: string | null;
  classType: string | null;
  level: string | null;
  gender: string | null;
  cost: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  projectOf: string | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getDayLabel(day: number): string {
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
}

function getLevelLabel(level: string | null): string {
  return SHIUR_LEVELS.find((l) => l.value === level)?.label || level || "";
}

function getGenderLabel(gender: string | null): string {
  return SHIUR_GENDERS.find((g) => g.value === gender)?.label || gender || "";
}

function getCategoryLabel(category: string | null): string {
  return SHIUR_CATEGORIES.find((c) => c.value === category)?.label || category || "";
}

// Get all days this shiur occurs on
function getShiurDays(shiur: Shiur): number[] {
  const days: number[] = [];

  // Check legacy dayOfWeek field
  if (shiur.dayOfWeek !== null) {
    days.push(shiur.dayOfWeek);
  }

  // Check schedule JSON
  if (shiur.schedule && typeof shiur.schedule === "object") {
    for (const day of DAYS_OF_WEEK) {
      const entry = shiur.schedule[day.value.toString()];
      if (entry?.start) {
        if (!days.includes(day.value)) {
          days.push(day.value);
        }
      }
    }
  }

  return days.sort((a, b) => a - b);
}

// Get schedule summary for display
function getScheduleSummary(shiur: Shiur): string {
  if (shiur.schedule && typeof shiur.schedule === "object") {
    const activeDays = DAYS_OF_WEEK.filter(day => {
      const entry = shiur.schedule?.[day.value.toString()];
      return entry?.start;
    });

    if (activeDays.length === 0) {
      // Fall back to legacy field
      if (shiur.dayOfWeek !== null && shiur.time) {
        return `${getDayLabel(shiur.dayOfWeek)} at ${formatTime(shiur.time)}`;
      }
      return "";
    }

    if (activeDays.length === 7) return "Daily";
    if (activeDays.length === 1) {
      const entry = shiur.schedule?.[activeDays[0].value.toString()];
      const timeStr = entry?.start ? ` at ${formatTime(entry.start)}` : "";
      return `${activeDays[0].label}${timeStr}`;
    }

    return activeDays.map(d => d.label.slice(0, 3)).join(", ");
  }

  // Legacy format
  if (shiur.dayOfWeek !== null && shiur.time) {
    return `${getDayLabel(shiur.dayOfWeek)} at ${formatTime(shiur.time)}`;
  }

  return "";
}

// Get location display text
function getLocationDisplay(shiur: Shiur): string | null {
  return shiur.shulName || shiur.locationName || shiur.location || null;
}

export default function ShiurimPage() {
  const [shiurim, setShiurim] = useState<Shiur[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  useEffect(() => {
    async function fetchShiurim() {
      try {
        const params = new URLSearchParams();
        if (dayFilter) params.append("day", dayFilter);
        if (levelFilter) params.append("level", levelFilter);
        if (genderFilter) params.append("gender", genderFilter);
        if (categoryFilter) params.append("category", categoryFilter);

        const response = await fetch(`/api/shiurim?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setShiurim(data);
        }
      } catch (error) {
        console.error("Error fetching shiurim:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchShiurim();
  }, [dayFilter, levelFilter, genderFilter, categoryFilter]);

  // Group shiurim by their primary day (first day in schedule)
  const groupedByDay = shiurim.reduce((acc, shiur) => {
    const days = getShiurDays(shiur);
    const primaryDay = days[0] ?? -1; // -1 for "no specific day"
    if (!acc[primaryDay]) acc[primaryDay] = [];
    acc[primaryDay].push(shiur);
    return acc;
  }, {} as Record<number, Shiur[]>);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-6">
              <BookOpen className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Torah Shiurim
            </h1>
            <p className="text-xl text-blue-100">
              Find Torah classes and learning opportunities across the Toronto Jewish community
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap mb-8">
          <Select value={dayFilter || "all"} onValueChange={(v) => setDayFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {DAYS_OF_WEEK.map((d) => (
                <SelectItem key={d.value} value={d.value.toString()}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {SHIUR_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {SHIUR_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={genderFilter || "all"} onValueChange={(v) => setGenderFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Everyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {SHIUR_GENDERS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(dayFilter || levelFilter || genderFilter || categoryFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setDayFilter("");
                setLevelFilter("");
                setGenderFilter("");
                setCategoryFilter("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Shiurim List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : shiurim.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Shiurim Found
              </h3>
              <p className="text-gray-500">
                Try adjusting your filters to find more shiurim.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {DAYS_OF_WEEK.map((day) => {
              const dayShiurim = groupedByDay[day.value];
              if (!dayShiurim || dayShiurim.length === 0) return null;

              return (
                <div key={day.value}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                    {day.label}
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {dayShiurim.map((shiur) => (
                      <Link key={shiur.id} href={`/shiurim/${shiur.id}`}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 mb-1">
                                  {shiur.title}
                                </h3>
                                {shiur.category && (
                                  <p className="text-sm text-blue-600 flex items-center gap-1">
                                    <Tag className="h-3 w-3" />
                                    {getCategoryLabel(shiur.category)}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0 ml-2">
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

                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span>{shiur.teacherName}</span>
                              </div>
                              {getScheduleSummary(shiur) && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span>{getScheduleSummary(shiur)}</span>
                                </div>
                              )}
                              {getLocationDisplay(shiur) && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-gray-400" />
                                  <span className="truncate">{getLocationDisplay(shiur)}</span>
                                </div>
                              )}
                            </div>

                            {(shiur.cost || shiur.projectOf) && (
                              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                {shiur.cost && (
                                  <span className="text-sm text-gray-500">
                                    Cost: <span className="font-medium text-gray-700">{shiur.cost}</span>
                                  </span>
                                )}
                                {shiur.projectOf && (
                                  <span className="text-sm text-gray-500">
                                    by {shiur.projectOf}
                                  </span>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Shiurim without a specific day */}
            {groupedByDay[-1] && groupedByDay[-1].length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-gray-400 rounded-full"></span>
                  Flexible Schedule
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {groupedByDay[-1].map((shiur) => (
                    <Link key={shiur.id} href={`/shiurim/${shiur.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 mb-1">
                                {shiur.title}
                              </h3>
                              {shiur.category && (
                                <p className="text-sm text-blue-600 flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {getCategoryLabel(shiur.category)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0 ml-2">
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

                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{shiur.teacherName}</span>
                            </div>
                            {getLocationDisplay(shiur) && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{getLocationDisplay(shiur)}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
