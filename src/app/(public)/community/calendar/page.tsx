"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Clock, ChevronLeft, ChevronRight, List, Grid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENT_TYPES } from "@/lib/validations/content";
import { HDate, gematriya } from "@hebcal/core";

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string | null;
  isAllDay: boolean | null;
  eventType: string | null;
  shulId: number | null;
  shulName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cost: string | null;
  imageUrl: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Hebrew month names
const HEBREW_MONTHS: Record<string, string> = {
  "Nisan": "ניסן",
  "Iyyar": "אייר",
  "Sivan": "סיון",
  "Tamuz": "תמוז",
  "Av": "אב",
  "Elul": "אלול",
  "Tishrei": "תשרי",
  "Cheshvan": "חשון",
  "Kislev": "כסלו",
  "Tevet": "טבת",
  "Sh'vat": "שבט",
  "Adar": "אדר",
  "Adar I": "אדר א׳",
  "Adar II": "אדר ב׳",
};

function getHebrewDate(year: number, month: number, day: number): { hebrewDay: string; hebrewMonth: string } {
  const hdate = new HDate(new Date(year, month, day));
  const hebrewDay = gematriya(hdate.getDate());
  const monthName = hdate.getMonthName();
  const hebrewMonth = HEBREW_MONTHS[monthName] || monthName;
  return { hebrewDay, hebrewMonth };
}

function getHebrewMonthsForGregorianMonth(year: number, month: number): string {
  // Get Hebrew month at start and end of the Gregorian month
  const startDate = new HDate(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const endDate = new HDate(new Date(year, month, daysInMonth));

  const startMonthName = startDate.getMonthName();
  const endMonthName = endDate.getMonthName();

  const startHebrew = HEBREW_MONTHS[startMonthName] || startMonthName;
  const endHebrew = HEBREW_MONTHS[endMonthName] || endMonthName;

  // If the month spans two Hebrew months, show both
  if (startMonthName !== endMonthName) {
    return `${startHebrew} / ${endHebrew}`;
  }

  return startHebrew;
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: string): string {
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

export default function EventsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showHebrewDates, setShowHebrewDates] = useState(true);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const params = new URLSearchParams();
        if (viewMode === "calendar") {
          params.append("month", (currentMonth + 1).toString());
          params.append("year", currentYear.toString());
        } else {
          params.append("upcoming", "true");
        }
        if (typeFilter !== "all") {
          params.append("type", typeFilter);
        }

        const response = await fetch(`/api/calendar?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [viewMode, currentMonth, currentYear, typeFilter]);

  function previousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function getDaysInMonth(month: number, year: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(month: number, year: number): number {
    return new Date(year, month, 1).getDay();
  }

  function getEventsForDate(day: number): CalendarEvent[] {
    return events.filter((event) => {
      const eventDate = new Date(event.startTime);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentMonth &&
        eventDate.getFullYear() === currentYear
      );
    });
  }

  function renderCalendar() {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDate(day);
      const isToday =
        day === new Date().getDate() &&
        currentMonth === new Date().getMonth() &&
        currentYear === new Date().getFullYear();

      const hebrewDate = showHebrewDates ? getHebrewDate(currentYear, currentMonth, day) : null;

      days.push(
        <div
          key={day}
          className={`h-24 border border-gray-100 p-1 overflow-hidden ${
            isToday ? "bg-blue-50" : "bg-white"
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <div
              className={`text-sm font-medium ${
                isToday ? "text-blue-600" : "text-gray-900"
              }`}
            >
              {day}
            </div>
            {hebrewDate && (
              <div className="text-xs text-blue-500" dir="rtl">
                {hebrewDate.hebrewDay}
              </div>
            )}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 2).map((event) => (
              <Link key={event.id} href={`/community/calendar/${event.id}`}>
                <div className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate hover:bg-blue-200 cursor-pointer">
                  {event.title}
                </div>
              </Link>
            ))}
            {dayEvents.length > 2 && (
              <button
                onClick={() => {
                  setSelectedDayEvents(dayEvents);
                  setSelectedDate(new Date(currentYear, currentMonth, day));
                }}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                +{dayEvents.length - 2} more
              </button>
            )}
          </div>
        </div>
      );
    }

    return days;
  }

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
              <Calendar className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Community Events
            </h1>
            <p className="text-xl text-blue-100">
              Discover upcoming events, shiurim, and celebrations in the Toronto Jewish community
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex gap-4 items-center">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <Grid className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={typeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter("all")}
            >
              All Events
            </Button>
            {EVENT_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={typeFilter === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {viewMode === "calendar" && (
          <div className="mb-8">
            {/* Hebrew dates toggle */}
            <div className="flex justify-end mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={showHebrewDates}
                  onCheckedChange={(checked) => setShowHebrewDates(checked === true)}
                />
                <span className="text-sm text-gray-600">Show Hebrew Dates</span>
              </label>
            </div>

            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                {showHebrewDates && (
                  <p className="text-sm text-gray-500" dir="rtl">
                    {getHebrewMonthsForGregorianMonth(currentYear, currentMonth)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="bg-gray-100 text-center py-2 text-sm font-medium text-gray-600"
                >
                  {day}
                </div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        )}

        {viewMode === "list" && (
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Upcoming Events
                  </h3>
                  <p className="text-gray-500">
                    Check back later for new community events.
                  </p>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Link key={event.id} href={`/community/calendar/${event.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="md:w-24 text-center md:text-left">
                          <div className="text-3xl font-bold text-blue-600">
                            {new Date(event.startTime).getDate()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {MONTHS[new Date(event.startTime).getMonth()].slice(0, 3)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {event.title}
                              </h3>
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="secondary">
                                  {getEventTypeLabel(event.eventType)}
                                </Badge>
                                {event.shulName && (
                                  <Badge variant="outline">{event.shulName}</Badge>
                                )}
                              </div>
                            </div>
                            {event.cost && (
                              <div className="text-right">
                                <span className="text-sm text-gray-500">Cost:</span>
                                <div className="font-medium">{event.cost}</div>
                              </div>
                            )}
                          </div>

                          {event.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                              {event.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {event.isAllDay ? (
                                "All Day"
                              ) : (
                                <>
                                  {formatTime(event.startTime)}
                                  {event.endTime && ` - ${formatTime(event.endTime)}`}
                                </>
                              )}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Day Events Dialog */}
        <Dialog open={!!selectedDayEvents} onOpenChange={() => setSelectedDayEvents(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Events on {selectedDate?.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayEvents?.map((event) => (
                <Link
                  key={event.id}
                  href={`/community/calendar/${event.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setSelectedDayEvents(null)}
                >
                  <h5 className="font-medium text-gray-900">{event.title}</h5>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {event.isAllDay ? "All Day" : formatTime(event.startTime)}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                  </div>
                  {event.shulName && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {event.shulName}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
