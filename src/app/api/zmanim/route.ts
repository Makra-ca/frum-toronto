import { NextResponse } from "next/server";
import {
  getZmanimForDate,
  getZmanimForWeek,
  formatZmanTime,
  getUpcomingShabbat,
} from "@/lib/zmanim";

// Cache for 1 hour - zmanim only change once per day
export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "today";
  const dateParam = searchParams.get("date");

  try {
    // Parse date if provided
    const date = dateParam ? new Date(dateParam) : new Date();

    if (mode === "week") {
      // Return week of zmanim
      const weekData = getZmanimForWeek(date);

      // Format times for JSON response
      const formattedWeek = weekData.map((day) => ({
        ...day,
        zmanim: {
          alotHaShachar: formatZmanTime(day.zmanim.alotHaShachar),
          misheyakir: formatZmanTime(day.zmanim.misheyakir),
          sunrise: formatZmanTime(day.zmanim.sunrise),
          sofZmanShma: formatZmanTime(day.zmanim.sofZmanShma),
          sofZmanTfilla: formatZmanTime(day.zmanim.sofZmanTfilla),
          chatzot: formatZmanTime(day.zmanim.chatzot),
          minchaGedola: formatZmanTime(day.zmanim.minchaGedola),
          minchaKetana: formatZmanTime(day.zmanim.minchaKetana),
          plagHaMincha: formatZmanTime(day.zmanim.plagHaMincha),
          sunset: formatZmanTime(day.zmanim.sunset),
          tzait: formatZmanTime(day.zmanim.tzait),
          tzait72: formatZmanTime(day.zmanim.tzait72),
        },
        candleLighting: formatZmanTime(day.candleLighting),
        havdalah: formatZmanTime(day.havdalah),
      }));

      return NextResponse.json(formattedWeek);
    }

    if (mode === "shabbat") {
      // Return upcoming Shabbat info
      const shabbatData = getUpcomingShabbat();

      return NextResponse.json({
        parsha: shabbatData.parsha,
        date: shabbatData.date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        candleLighting: formatZmanTime(shabbatData.candleLighting),
        havdalah: formatZmanTime(shabbatData.havdalah),
      });
    }

    // Default: return today's zmanim
    const zmanimData = getZmanimForDate(date);

    // Format times for JSON response
    const formattedData = {
      ...zmanimData,
      zmanim: {
        alotHaShachar: formatZmanTime(zmanimData.zmanim.alotHaShachar),
        misheyakir: formatZmanTime(zmanimData.zmanim.misheyakir),
        sunrise: formatZmanTime(zmanimData.zmanim.sunrise),
        sofZmanShma: formatZmanTime(zmanimData.zmanim.sofZmanShma),
        sofZmanTfilla: formatZmanTime(zmanimData.zmanim.sofZmanTfilla),
        chatzot: formatZmanTime(zmanimData.zmanim.chatzot),
        minchaGedola: formatZmanTime(zmanimData.zmanim.minchaGedola),
        minchaKetana: formatZmanTime(zmanimData.zmanim.minchaKetana),
        plagHaMincha: formatZmanTime(zmanimData.zmanim.plagHaMincha),
        sunset: formatZmanTime(zmanimData.zmanim.sunset),
        tzait: formatZmanTime(zmanimData.zmanim.tzait),
        tzait72: formatZmanTime(zmanimData.zmanim.tzait72),
      },
      candleLighting: formatZmanTime(zmanimData.candleLighting),
      havdalah: formatZmanTime(zmanimData.havdalah),
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error calculating zmanim:", error);
    return NextResponse.json(
      { error: "Failed to calculate zmanim" },
      { status: 500 }
    );
  }
}
