"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Sunrise, Sunset, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder data - will be replaced with @hebcal/core calculations
const zmanimData = {
  date: "Wednesday, December 18, 2024",
  hebrewDate: "17 Kislev 5785",
  parsha: "Vayishlach",
  zmanim: {
    alotHaShachar: "6:14 AM",
    misheyakir: "6:44 AM",
    sunrise: "7:45 AM",
    sofZmanShma: "9:38 AM",
    sofZmanTfilla: "10:28 AM",
    chatzot: "12:09 PM",
    minchaGedola: "12:34 PM",
    minchaKetana: "3:04 PM",
    plagHaMincha: "4:00 PM",
    sunset: "4:36 PM",
    tzait: "5:13 PM",
  },
  candleLighting: null,
  havdalah: null,
};

export function ZmanimWidget() {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Today&apos;s Zmanim
        </CardTitle>
        <p className="text-sm text-gray-600">{zmanimData.date}</p>
        <p className="text-sm text-blue-600 font-medium">{zmanimData.hebrewDate}</p>
        {zmanimData.parsha && (
          <p className="text-xs text-gray-500">Parshas {zmanimData.parsha}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <ZmanRow icon={Moon} label="Alos" time={zmanimData.zmanim.alotHaShachar} />
          <ZmanRow icon={Sunrise} label="Sunrise" time={zmanimData.zmanim.sunrise} />
          <ZmanRow label="Shma" time={zmanimData.zmanim.sofZmanShma} />
          <ZmanRow label="Tefilla" time={zmanimData.zmanim.sofZmanTfilla} />
          <ZmanRow icon={Sun} label="Chatzos" time={zmanimData.zmanim.chatzot} />
          <ZmanRow label="Mincha G." time={zmanimData.zmanim.minchaGedola} />
          <ZmanRow label="Plag" time={zmanimData.zmanim.plagHaMincha} />
          <ZmanRow icon={Sunset} label="Sunset" time={zmanimData.zmanim.sunset} />
        </div>

        {(zmanimData.candleLighting || zmanimData.havdalah) && (
          <>
            <Separator />
            <div className="pt-2">
              {zmanimData.candleLighting && (
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Candle Lighting</span>
                  <span className="text-blue-600">{zmanimData.candleLighting}</span>
                </div>
              )}
              {zmanimData.havdalah && (
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Havdalah</span>
                  <span className="text-blue-600">{zmanimData.havdalah}</span>
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
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  time: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="font-medium text-gray-900">{time}</span>
    </div>
  );
}
