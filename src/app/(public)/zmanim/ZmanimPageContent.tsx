"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Loader2,
  Flame,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarSearch,
  MapPin,
  Star,
} from "lucide-react";

interface ZmanimDay {
  date: string;
  hebrewDate: string;
  hebrewDateHebrew: string;
  parsha: string | null;
  specialDay: string | null;
  zmanim: {
    alotHaShachar: string;
    misheyakir: string;
    sunrise: string;
    sofZmanShma: string;
    sofZmanTfilla: string;
    chatzot: string;
    minchaGedola: string;
    minchaKetana: string;
    plagHaMincha: string;
    sunset: string;
    tzait: string;
    tzait72: string;
  };
  candleLighting: string;
  havdalah: string;
  isShabbat: boolean;
  isYomTov: boolean;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ZmanimPageContent() {
  const [weekData, setWeekData] = useState<ZmanimDay[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => getStartOfWeek(new Date()));

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/zmanim?mode=week&date=${startDate.toISOString()}`)
      .then((res) => res.json())
      .then((data) => {
        setWeekData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch zmanim:", err);
        setIsLoading(false);
      });
  }, [startDate]);

  const goToPreviousWeek = () => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToPreviousMonth = () => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return getStartOfWeek(d);
    });
  };

  const goToNextMonth = () => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return getStartOfWeek(d);
    });
  };

  const goToToday = () => {
    setStartDate(getStartOfWeek(new Date()));
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const picked = new Date(val + "T12:00:00");
    if (!isNaN(picked.getTime())) {
      setStartDate(getStartOfWeek(picked));
    }
  };

  const isCurrentWeek = useMemo(() => {
    const thisWeekStart = getStartOfWeek(new Date());
    return startDate.getTime() === thisWeekStart.getTime();
  }, [startDate]);

  // Find Friday's data for the Shabbat banner
  const fridayData = weekData?.find((day) => {
    const d = new Date(day.date);
    return d.getDay() === 5;
  });
  const saturdayData = weekData?.find((day) => {
    const d = new Date(day.date);
    return d.getDay() === 6;
  });

  const hasCandleLighting = fridayData?.candleLighting && fridayData.candleLighting !== "--:--";
  const hasHavdalah = saturdayData?.havdalah && saturdayData.havdalah !== "--:--";
  const shabbatParsha = saturdayData?.parsha || fridayData?.parsha;

  if (isLoading && !weekData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Unable to load zmanim</p>
      </div>
    );
  }

  const today = new Date().toDateString();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Zmanim for Toronto
        </h1>
        <p className="text-gray-600 flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          Toronto, Ontario, Canada
        </p>
      </div>

      {/* Shabbat Banner */}
      {(hasCandleLighting || hasHavdalah) && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/10 p-2.5">
                <Star className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  Shabbat{shabbatParsha ? ` Parshas ${shabbatParsha}` : ""}
                </h2>
                {fridayData && (
                  <p className="text-sm text-blue-200">
                    {fridayData.date}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              {hasCandleLighting && (
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-amber-300 mb-0.5">
                    <Flame className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Candle Lighting</span>
                  </div>
                  <p className="text-2xl font-bold">{fridayData!.candleLighting}</p>
                </div>
              )}
              {hasHavdalah && (
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-blue-200 mb-0.5">
                    <Moon className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Havdalah</span>
                  </div>
                  <p className="text-2xl font-bold">{saturdayData!.havdalah}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mb-6 space-y-3">
        {/* Date Picker Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={formatDateForInput(startDate)}
              onChange={handleDatePick}
              aria-label="Jump to date"
            />
          </div>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          )}
        </div>

        {/* Week/Month Navigation Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} title="Previous month">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Week
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth} title="Next month">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Weekly Zmanim Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weekData.map((day, index) => {
          const isToday = new Date(day.date).toDateString() === today;
          const dayDate = new Date(day.date);
          const isFriday = dayDate.getDay() === 5;
          const isSaturday = dayDate.getDay() === 6;
          const hasDayCandleLighting = day.candleLighting && day.candleLighting !== "--:--";
          const hasDayHavdalah = day.havdalah && day.havdalah !== "--:--";

          return (
            <Card
              key={index}
              className={`border ${
                isToday
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : isFriday || isSaturday
                  ? "border-blue-200 bg-blue-50/50"
                  : ""
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{day.date.split(",")[0]}</span>
                  <div className="flex items-center gap-1">
                    {(isFriday || isSaturday) && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Shabbat
                      </span>
                    )}
                    {isToday && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {day.date.split(", ").slice(1).join(", ")}
                </p>
                <p className="text-sm text-blue-600 font-medium">{day.hebrewDate}</p>
                {day.parsha && (
                  <p className="text-xs text-gray-500">Parshas {day.parsha}</p>
                )}
                {day.specialDay && (
                  <p className="text-xs text-orange-600 font-medium">{day.specialDay}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="space-y-1">
                  <ZmanItem icon={Moon} label="Alos HaShachar" time={day.zmanim.alotHaShachar} />
                  <ZmanItem label="Misheyakir" time={day.zmanim.misheyakir} />
                  <ZmanItem icon={Sunrise} label="Sunrise" time={day.zmanim.sunrise} />
                  <ZmanItem label="Sof Zman Shma" time={day.zmanim.sofZmanShma} highlight />
                  <ZmanItem label="Sof Zman Tefilla" time={day.zmanim.sofZmanTfilla} />
                  <ZmanItem icon={Sun} label="Chatzos" time={day.zmanim.chatzot} />
                  <ZmanItem label="Mincha Gedola" time={day.zmanim.minchaGedola} />
                  <ZmanItem label="Mincha Ketana" time={day.zmanim.minchaKetana} />
                  <ZmanItem label="Plag HaMincha" time={day.zmanim.plagHaMincha} />
                  <ZmanItem icon={Sunset} label="Sunset" time={day.zmanim.sunset} highlight />
                  <ZmanItem label="Tzais" time={day.zmanim.tzait} />
                  <ZmanItem label="Tzais 72" time={day.zmanim.tzait72} />
                </div>

                {(hasDayCandleLighting || hasDayHavdalah) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {hasDayCandleLighting && (
                        <div className="flex justify-between items-center font-medium">
                          <span className="flex items-center gap-1 text-orange-600">
                            <Flame className="h-3 w-3" />
                            Candle Lighting
                          </span>
                          <span className="text-orange-600">{day.candleLighting}</span>
                        </div>
                      )}
                      {hasDayHavdalah && (
                        <div className="flex justify-between items-center font-medium">
                          <span className="flex items-center gap-1 text-blue-600">
                            <Moon className="h-3 w-3" />
                            Havdalah
                          </span>
                          <span className="text-blue-600">{day.havdalah}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">About These Zmanim</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Times are calculated for Toronto, ON (43.66°N, 79.40°W)</li>
          <li>• Zmanim are based on the Magen Avraham calculation method</li>
          <li>• Candle lighting is 18 minutes before sunset</li>
          <li>• Havdalah is calculated at 50 minutes after sunset</li>
          <li>• Always verify times with your local Rabbi</li>
        </ul>
      </div>
    </div>
  );
}

function ZmanItem({
  icon: Icon,
  label,
  time,
  highlight,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  time: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className={`font-medium ${highlight ? "text-blue-600" : "text-gray-900"}`}>
        {time}
      </span>
    </div>
  );
}
