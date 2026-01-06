"use client";

import { useState, useMemo } from "react";
import { HDate, months } from "@hebcal/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  id: number;
  title: string;
  description: string | null;
  startTime: Date | string;
  endTime: Date | string | null;
  isAllDay: boolean | null;
  eventType: string | null;
  location: string | null;
}

interface ShulEventsCalendarProps {
  events: Event[];
}

const HEBREW_MONTHS: Record<number, string> = {
  [months.NISAN]: "ניסן",
  [months.IYYAR]: "אייר",
  [months.SIVAN]: "סיון",
  [months.TAMUZ]: "תמוז",
  [months.AV]: "אב",
  [months.ELUL]: "אלול",
  [months.TISHREI]: "תשרי",
  [months.CHESHVAN]: "חשון",
  [months.KISLEV]: "כסלו",
  [months.TEVET]: "טבת",
  [months.SHVAT]: "שבט",
  [months.ADAR_I]: "אדר א׳",
  [months.ADAR_II]: "אדר ב׳",
};

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳",
  "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ׳",
  "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל׳"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getHebrewDateStr(date: Date): string {
  const hd = new HDate(date);
  const day = hd.getDate();
  return HEBREW_DAYS[day - 1] || day.toString();
}

function getHebrewMonthName(date: Date): string {
  const hd = new HDate(date);
  return HEBREW_MONTHS[hd.getMonth()] || "";
}

export function ShulEventsCalendar({ events }: ShulEventsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(currentYear, currentMonth, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month padding to complete the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((event) => {
      const startDate = new Date(event.startTime);
      const dateKey = startDate.toISOString().split("T")[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const hebrewMonth = getHebrewMonthName(new Date(currentYear, currentMonth, 15));

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatEventTime = (date: Date | string, isAllDay: boolean | null) => {
    if (isAllDay) return "All Day";
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">{monthName}</h3>
          <p className="text-sm text-gray-500 font-hebrew">{hebrewMonth}</p>
        </div>
        <div className="w-[100px]"></div> {/* Spacer for balance */}
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dateKey = date.toISOString().split("T")[0];
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isToday = date.getTime() === today.getTime();
            const hebrewDay = getHebrewDateStr(date);

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] border-b border-r p-1",
                  !isCurrentMonth && "bg-gray-50",
                  isToday && "bg-blue-50"
                )}
              >
                {/* Date Headers */}
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                      isToday && "bg-blue-600 text-white font-semibold",
                      !isToday && !isCurrentMonth && "text-gray-400",
                      !isToday && isCurrentMonth && "text-gray-700"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <span className={cn(
                    "text-xs font-hebrew",
                    !isCurrentMonth ? "text-gray-300" : "text-gray-400"
                  )}>
                    {hebrewDay}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs bg-blue-100 text-blue-800 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-blue-200"
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 pl-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events List */}
      {events.length > 0 ? (
        <div className="space-y-3 mt-6">
          <h4 className="font-medium text-gray-700">Upcoming Events</h4>
          {events.slice(0, 5).map((event) => {
            const startDate = new Date(event.startTime);
            const hDate = new HDate(startDate);

            return (
              <div
                key={event.id}
                className="flex gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="text-center min-w-[60px]">
                  <div className="text-2xl font-bold text-blue-600">
                    {startDate.getDate()}
                  </div>
                  <div className="text-xs text-gray-500 uppercase">
                    {startDate.toLocaleDateString("en-US", { month: "short" })}
                  </div>
                  <div className="text-xs text-gray-400 font-hebrew">
                    {getHebrewDateStr(startDate)} {getHebrewMonthName(startDate)}
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="font-medium">{event.title}</h5>
                  <p className="text-sm text-gray-500">
                    {formatEventTime(event.startTime, event.isAllDay)}
                    {event.location && ` • ${event.location}`}
                  </p>
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No upcoming events scheduled.</p>
          <p className="text-sm text-gray-400">Check back later for updates.</p>
        </div>
      )}
    </div>
  );
}
