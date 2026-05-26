"use client";

import { useMemo } from "react";
import { HDate } from "@hebcal/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

function getOmerDay(today: Date): number | null {
  try {
    const hdate = new HDate(today);
    const hYear = hdate.getFullYear();

    // Omer starts: 16 Nisan (day after first seder night)
    const omerStart = new HDate(16, "Nisan", hYear);
    // Omer ends: 5 Sivan (day 49, the eve of Shavuot)
    const omerEnd = new HDate(5, "Sivan", hYear);

    const todayAbs = hdate.abs();
    const startAbs = omerStart.abs();
    const endAbs = omerEnd.abs();

    if (todayAbs < startAbs || todayAbs > endAbs) return null;

    return todayAbs - startAbs + 1; // Day 1 through 49
  } catch {
    return null;
  }
}

export function OmerWidget() {
  const day = useMemo(() => getOmerDay(new Date()), []);

  if (!day) return null;

  const weeks = Math.floor((day - 1) / 7);
  const remainingDays = (day - 1) % 7;

  let breakdown = "";
  if (weeks > 0 && remainingDays > 0) {
    breakdown = `${weeks} week${weeks > 1 ? "s" : ""} and ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
  } else if (weeks > 0) {
    breakdown = `${weeks} complete week${weeks > 1 ? "s" : ""}`;
  } else {
    breakdown = `${day} day${day > 1 ? "s" : ""}`;
  }

  const daysRemaining = 49 - day;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
          Sefirat HaOmer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-center py-1">
          <div className="text-4xl font-bold text-amber-600">{day}</div>
          <div className="text-sm text-gray-500 mt-0.5">of 49 days</div>
        </div>
        <p className="text-sm text-center text-gray-700 font-medium">{breakdown}</p>
        {daysRemaining > 0 && (
          <p className="text-xs text-center text-gray-400">
            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining until Shavuot
          </p>
        )}
        {daysRemaining === 0 && (
          <p className="text-xs text-center text-amber-600 font-medium">
            Tonight is Shavuot!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
