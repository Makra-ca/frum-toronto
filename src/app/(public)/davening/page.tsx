"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, MapPin, Building2, Search } from "lucide-react";
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
import { DAYS_OF_WEEK, TEFILAH_TYPES } from "@/lib/validations/content";

interface DaveningSchedule {
  id: number;
  shulId: number | null;
  shulName: string | null;
  shulAddress: string | null;
  tefilahType: string | null;
  dayOfWeek: number | null;
  time: string;
  notes: string | null;
  isWinter: boolean | null;
  isSummer: boolean | null;
  isShabbos: boolean | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
}

interface Shul {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getDayLabel(day: number | null): string {
  if (day === null) return "Daily";
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
}

function getTefilahLabel(type: string | null): string {
  return TEFILAH_TYPES.find((t) => t.value === type)?.label || type || "Unknown";
}

export default function DaveningPage() {
  const [view, setView] = useState<"minyanim" | "shuls">("minyanim");
  const [schedules, setSchedules] = useState<DaveningSchedule[]>([]);
  const [shuls, setShuls] = useState<Shul[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [tefilahFilter, setTefilahFilter] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        if (view === "minyanim") {
          const params = new URLSearchParams();
          if (dayFilter) params.append("day", dayFilter);
          if (tefilahFilter) params.append("type", tefilahFilter);

          const response = await fetch(`/api/davening?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setSchedules(data);
          }
        } else {
          const response = await fetch("/api/shuls");
          if (response.ok) {
            const data = await response.json();
            setShuls(data);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchData();
  }, [view, dayFilter, tefilahFilter]);

  // Group schedules by shul
  const groupedByShul = schedules.reduce((acc, schedule) => {
    const shulId = schedule.shulId || 0;
    if (!acc[shulId]) {
      acc[shulId] = {
        shulName: schedule.shulName || "Unknown",
        shulAddress: schedule.shulAddress,
        rabbi: schedule.rabbi,
        denomination: schedule.denomination,
        nusach: schedule.nusach,
        schedules: [],
      };
    }
    acc[shulId].schedules.push(schedule);
    return acc;
  }, {} as Record<number, { shulName: string; shulAddress: string | null; rabbi: string | null; denomination: string | null; nusach: string | null; schedules: DaveningSchedule[] }>);

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
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find a Minyan
            </h1>
            <p className="text-xl text-blue-100">
              Davening times and shul listings across Toronto
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* View Toggle */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={view === "minyanim" ? "default" : "outline"}
            onClick={() => setView("minyanim")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Minyan Times
          </Button>
          <Button
            variant={view === "shuls" ? "default" : "outline"}
            onClick={() => setView("shuls")}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Shul Directory
          </Button>
        </div>

        {view === "minyanim" && (
          <>
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

              <Select value={tefilahFilter || "all"} onValueChange={(v) => setTefilahFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Tefilot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tefilot</SelectItem>
                  {TEFILAH_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(dayFilter || tefilahFilter) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDayFilter("");
                    setTefilahFilter("");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Minyan List */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : Object.keys(groupedByShul).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Minyanim Found
                  </h3>
                  <p className="text-gray-500">
                    Try adjusting your filters to find more minyanim.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByShul).map(([shulId, data]) => (
                  <Card key={shulId}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {data.shulName}
                          </h3>
                          {data.shulAddress && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <MapPin className="h-4 w-4" />
                              {data.shulAddress}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {data.denomination && (
                            <Badge variant="secondary">{data.denomination}</Badge>
                          )}
                          {data.nusach && (
                            <Badge variant="outline">{data.nusach}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        {TEFILAH_TYPES.map((tefilah) => {
                          const tefilahSchedules = data.schedules.filter(
                            (s) => s.tefilahType === tefilah.value
                          );
                          if (tefilahSchedules.length === 0) return null;

                          return (
                            <div key={tefilah.value} className="bg-gray-50 rounded-lg p-4">
                              <h4 className="font-medium text-gray-900 mb-2">
                                {tefilah.label}
                              </h4>
                              <div className="space-y-1">
                                {tefilahSchedules.map((schedule) => (
                                  <div
                                    key={schedule.id}
                                    className="text-sm text-gray-600 flex justify-between"
                                  >
                                    <span>{getDayLabel(schedule.dayOfWeek)}</span>
                                    <span className="font-medium">
                                      {formatTime(schedule.time)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {data.rabbi && (
                        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                          Rabbi: {data.rabbi}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {view === "shuls" && (
          <>
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : shuls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Shuls Found
                  </h3>
                  <p className="text-gray-500">
                    Check back later for shul listings.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shuls.map((shul) => (
                  <Link key={shul.id} href={`/davening/${shul.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {shul.name}
                        </h3>

                        <div className="flex gap-2 mb-3">
                          {shul.denomination && (
                            <Badge variant="secondary" className="text-xs">
                              {shul.denomination}
                            </Badge>
                          )}
                          {shul.nusach && (
                            <Badge variant="outline" className="text-xs">
                              {shul.nusach}
                            </Badge>
                          )}
                        </div>

                        {shul.address && (
                          <div className="flex items-start gap-2 text-sm text-gray-500 mb-2">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{shul.address}</span>
                          </div>
                        )}

                        {shul.rabbi && (
                          <div className="text-sm text-gray-500">
                            Rabbi: {shul.rabbi}
                          </div>
                        )}

                        {shul.hasMinyan && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Daily Minyan
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
