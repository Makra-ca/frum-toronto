"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, MapPin, Clock, User, Tag, CalendarDays, List } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAYS_OF_WEEK, SHIUR_LEVELS, SHIUR_GENDERS, SHIUR_CATEGORIES } from "@/lib/validations/content";
import { ShiurSubmitModal } from "@/components/shiurim/ShiurSubmitModal";

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

interface FilterOptions {
  days: number[];
  categories: string[];
  levels: string[];
  genders: string[];
  areas: string[];
  teachers: string[];
  organizations: string[];
}

export default function ShiurimPage() {
  const [shiurim, setShiurim] = useState<Shiur[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [dayFilter, setDayFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [organizationFilter, setOrganizationFilter] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    days: [],
    categories: [],
    levels: [],
    genders: [],
    areas: [],
    teachers: [],
    organizations: [],
  });

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const response = await fetch("/api/shiurim?filters=true");
        if (response.ok) {
          const data = await response.json();
          setFilterOptions(data);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    }
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    async function fetchShiurim() {
      try {
        const params = new URLSearchParams();
        if (dayFilter) params.append("day", dayFilter);
        if (levelFilter) params.append("level", levelFilter);
        if (genderFilter) params.append("gender", genderFilter);
        if (categoryFilter) params.append("category", categoryFilter);
        if (areaFilter) params.append("area", areaFilter);
        if (teacherFilter) params.append("teacher", teacherFilter);
        if (organizationFilter) params.append("organization", organizationFilter);

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
  }, [dayFilter, levelFilter, genderFilter, categoryFilter, areaFilter, teacherFilter, organizationFilter]);

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
            <p className="text-xl text-blue-100 mb-6">
              Find Torah classes and learning opportunities across the Toronto Jewish community
            </p>
            <ShiurSubmitModal />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Filters - only show when there's data */}
        {(filterOptions.days.length > 0 || filterOptions.categories.length > 0 ||
          filterOptions.levels.length > 0 || filterOptions.genders.length > 0 ||
          filterOptions.areas.length > 0 || filterOptions.teachers.length > 0 ||
          filterOptions.organizations.length > 0) && (
          <div className="flex gap-4 flex-wrap mb-8">
            {filterOptions.days.length > 0 && (
              <Select value={dayFilter || "all"} onValueChange={(v) => setDayFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {filterOptions.days.map((dayNum) => {
                    const dayInfo = DAYS_OF_WEEK.find(d => d.value === dayNum);
                    return (
                      <SelectItem key={dayNum} value={dayNum.toString()}>
                        {dayInfo?.label || `Day ${dayNum}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {filterOptions.categories.length > 0 && (
              <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {filterOptions.categories.map((cat) => {
                    const catInfo = SHIUR_CATEGORIES.find(c => c.value === cat);
                    return (
                      <SelectItem key={cat} value={cat}>
                        {catInfo?.label || cat}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {filterOptions.levels.length > 0 && (
              <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {filterOptions.levels.map((lvl) => {
                    const lvlInfo = SHIUR_LEVELS.find(l => l.value === lvl);
                    return (
                      <SelectItem key={lvl} value={lvl}>
                        {lvlInfo?.label || lvl}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {filterOptions.genders.length > 0 && (
              <Select value={genderFilter || "all"} onValueChange={(v) => setGenderFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Everyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {filterOptions.genders.map((gen) => {
                    const genInfo = SHIUR_GENDERS.find(g => g.value === gen);
                    return (
                      <SelectItem key={gen} value={gen}>
                        {genInfo?.label || gen}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {filterOptions.areas.length > 0 && (
              <Select value={areaFilter || "all"} onValueChange={(v) => setAreaFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {filterOptions.areas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filterOptions.teachers.length > 0 && (
              <Select value={teacherFilter || "all"} onValueChange={(v) => setTeacherFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Teachers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {filterOptions.teachers.map((teacher) => (
                    <SelectItem key={teacher} value={teacher}>
                      {teacher}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filterOptions.organizations.length > 0 && (
              <Select value={organizationFilter || "all"} onValueChange={(v) => setOrganizationFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {filterOptions.organizations.map((org) => (
                    <SelectItem key={org} value={org}>
                      {org}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(dayFilter || levelFilter || genderFilter || categoryFilter || areaFilter || teacherFilter || organizationFilter) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDayFilter("");
                  setLevelFilter("");
                  setGenderFilter("");
                  setCategoryFilter("");
                  setAreaFilter("");
                  setTeacherFilter("");
                  setOrganizationFilter("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* View Toggle */}
        <div className="flex justify-end mb-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list")}>
            <TabsList>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Shiurim Display */}
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
                {filterOptions.days.length === 0
                  ? "No shiurim have been added yet. Be the first to submit one!"
                  : "Try adjusting your filters to find more shiurim."}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "calendar" ? (
          /* Calendar View */
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {DAYS_OF_WEEK.map((day) => {
              const dayShiurim = groupedByDay[day.value] || [];
              return (
                <div key={day.value} className="bg-white rounded-lg border min-h-[200px]">
                  <div className="bg-blue-600 text-white px-3 py-2 rounded-t-lg font-semibold text-center">
                    {day.label}
                  </div>
                  <div className="p-2 space-y-2">
                    {dayShiurim.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No shiurim</p>
                    ) : (
                      dayShiurim.map((shiur) => (
                        <Link key={shiur.id} href={`/shiurim/${shiur.id}`}>
                          <div className="p-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer transition-colors">
                            <p className="font-medium text-sm text-gray-900 line-clamp-2">
                              {shiur.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {shiur.teacherName}
                            </p>
                            {shiur.time && (
                              <p className="text-xs text-blue-600 mt-1">
                                {formatTime(shiur.time)}
                              </p>
                            )}
                            {shiur.category && (
                              <Badge variant="secondary" className="text-[10px] mt-1 px-1 py-0">
                                {getCategoryLabel(shiur.category)}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
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
