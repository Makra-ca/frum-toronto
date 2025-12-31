"use client";

import { useState, useEffect } from "react";
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
  MapPin,
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

export function ZmanimPageContent() {
  const [weekData, setWeekData] = useState<ZmanimDay[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + weekOffset * 7);

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
  }, [weekOffset]);

  const goToPreviousWeek = () => setWeekOffset((prev) => prev - 1);
  const goToNextWeek = () => setWeekOffset((prev) => prev + 1);
  const goToCurrentWeek = () => setWeekOffset(0);

  if (isLoading) {
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

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Week
        </Button>

        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
            This Week
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={goToNextWeek}>
          Next Week
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Weekly Zmanim Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weekData.map((day, index) => {
          const isToday = new Date(day.date).toDateString() === today;
          const hasCandleLighting = day.candleLighting && day.candleLighting !== "--:--";
          const hasHavdalah = day.havdalah && day.havdalah !== "--:--";

          return (
            <Card
              key={index}
              className={`border ${
                isToday ? "border-blue-500 ring-2 ring-blue-100" : ""
              } ${day.isShabbat ? "bg-blue-50/50" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{day.date.split(",")[0]}</span>
                  {isToday && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                      Today
                    </span>
                  )}
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

                {(hasCandleLighting || hasHavdalah) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {hasCandleLighting && (
                        <div className="flex justify-between items-center font-medium">
                          <span className="flex items-center gap-1 text-orange-600">
                            <Flame className="h-3 w-3" />
                            Candle Lighting
                          </span>
                          <span className="text-orange-600">{day.candleLighting}</span>
                        </div>
                      )}
                      {hasHavdalah && (
                        <div className="flex justify-between items-center font-medium">
                          <span>Havdalah</span>
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
