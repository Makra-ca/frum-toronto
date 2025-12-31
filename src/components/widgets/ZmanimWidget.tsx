"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Sunrise, Sunset, Sun, Moon, Loader2, Flame } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ZmanimApiResponse {
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

export function ZmanimWidget() {
  const [data, setData] = useState<ZmanimApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/zmanim")
      .then((res) => res.json())
      .then((result) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch zmanim:", err);
        setError("Failed to load zmanim");
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Today&apos;s Zmanim
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Today&apos;s Zmanim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Unable to load zmanim</p>
        </CardContent>
      </Card>
    );
  }

  const hasCandleLighting = data.candleLighting && data.candleLighting !== "--:--";
  const hasHavdalah = data.havdalah && data.havdalah !== "--:--";

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Today&apos;s Zmanim
        </CardTitle>
        <p className="text-sm text-gray-600">{data.date}</p>
        <p className="text-sm text-blue-600 font-medium">{data.hebrewDate}</p>
        {data.parsha && (
          <p className="text-xs text-gray-500">Parshas {data.parsha}</p>
        )}
        {data.specialDay && (
          <p className="text-xs text-orange-600 font-medium">{data.specialDay}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <ZmanRow icon={Moon} label="Alos" time={data.zmanim.alotHaShachar} />
          <ZmanRow icon={Sunrise} label="Sunrise" time={data.zmanim.sunrise} />
          <ZmanRow label="Shma" time={data.zmanim.sofZmanShma} highlight />
          <ZmanRow label="Tefilla" time={data.zmanim.sofZmanTfilla} />
          <ZmanRow icon={Sun} label="Chatzos" time={data.zmanim.chatzot} />
          <ZmanRow label="Mincha G." time={data.zmanim.minchaGedola} />
          <ZmanRow label="Plag" time={data.zmanim.plagHaMincha} />
          <ZmanRow icon={Sunset} label="Sunset" time={data.zmanim.sunset} highlight />
        </div>

        {(hasCandleLighting || hasHavdalah) && (
          <>
            <Separator />
            <div className="pt-2 space-y-1">
              {hasCandleLighting && (
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-500" />
                    Candle Lighting
                  </span>
                  <span className="text-orange-600">{data.candleLighting}</span>
                </div>
              )}
              {hasHavdalah && (
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Havdalah</span>
                  <span className="text-blue-600">{data.havdalah}</span>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/zmanim">View Full Zmanim</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ZmanRow({
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
