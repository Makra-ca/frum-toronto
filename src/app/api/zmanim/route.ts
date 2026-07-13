import { NextResponse } from "next/server";
import {
  getZmanimForDate,
  getZmanimForWeek,
  formatZmanTime,
  getUpcomingShabbat,
} from "@/lib/zmanim";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

// revalidate hint; handler is dynamic because it reads query params —
// each location is computed fresh (no cross-location cache poisoning)
export const revalidate = 3600;

function parseLocation(
  searchParams: URLSearchParams
): { location: ZmanimLocation } | { error: string } {
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const tzidParam = searchParams.get("tzid");

  // No location params provided → default to Toronto (backward compatible)
  if (latParam === null && lonParam === null && tzidParam === null) {
    return { location: TORONTO_LOCATION };
  }

  // At least one location param present → require a complete, valid set.
  // Guard against empty/whitespace strings: Number("") === 0 would otherwise
  // coerce blank coords to a valid (0, 0) location instead of a 400.
  const lat = Number(latParam);
  const lon = Number(lonParam);

  if (
    latParam === null ||
    latParam.trim() === "" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    return { error: "Invalid or missing 'lat' (must be a number between -90 and 90)" };
  }

  if (
    lonParam === null ||
    lonParam.trim() === "" ||
    !Number.isFinite(lon) ||
    lon < -180 ||
    lon > 180
  ) {
    return { error: "Invalid or missing 'lon' (must be a number between -180 and 180)" };
  }

  if (tzidParam === null || tzidParam.trim().length === 0) {
    return { error: "Invalid or missing 'tzid' (must be a non-empty IANA timezone id)" };
  }

  const label = searchParams.get("label") || "Selected location";
  const isIsrael = searchParams.get("il") === "1";

  return {
    location: {
      lat,
      lon,
      tzid: tzidParam,
      label,
      isIsrael,
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "today";
  const dateParam = searchParams.get("date");

  const parsed = parseLocation(searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { location } = parsed;

  try {
    // Parse date if provided
    const date = dateParam ? new Date(dateParam) : new Date();

    if (mode === "week") {
      // Return week of zmanim
      const weekData = getZmanimForWeek(date, location);

      // Format times for JSON response
      const formattedWeek = weekData.map((day) => ({
        ...day,
        zmanim: {
          alotHaShachar: formatZmanTime(day.zmanim.alotHaShachar, location.tzid),
          misheyakir: formatZmanTime(day.zmanim.misheyakir, location.tzid),
          sunrise: formatZmanTime(day.zmanim.sunrise, location.tzid),
          sofZmanShma: formatZmanTime(day.zmanim.sofZmanShma, location.tzid),
          sofZmanTfilla: formatZmanTime(day.zmanim.sofZmanTfilla, location.tzid),
          chatzot: formatZmanTime(day.zmanim.chatzot, location.tzid),
          minchaGedola: formatZmanTime(day.zmanim.minchaGedola, location.tzid),
          minchaKetana: formatZmanTime(day.zmanim.minchaKetana, location.tzid),
          plagHaMincha: formatZmanTime(day.zmanim.plagHaMincha, location.tzid),
          sunset: formatZmanTime(day.zmanim.sunset, location.tzid),
          tzait: formatZmanTime(day.zmanim.tzait, location.tzid),
          tzait72: formatZmanTime(day.zmanim.tzait72, location.tzid),
        },
        candleLighting: formatZmanTime(day.candleLighting, location.tzid),
        havdalah: formatZmanTime(day.havdalah, location.tzid),
      }));

      return NextResponse.json(formattedWeek);
    }

    if (mode === "shabbat") {
      // Return upcoming Shabbat info (intentionally Toronto-only)
      const shabbatData = getUpcomingShabbat();

      return NextResponse.json({
        parsha: shabbatData.parsha,
        date: shabbatData.date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        candleLighting: formatZmanTime(
          shabbatData.candleLighting,
          TORONTO_LOCATION.tzid
        ),
        havdalah: formatZmanTime(shabbatData.havdalah, TORONTO_LOCATION.tzid),
      });
    }

    // Default: return today's zmanim
    const zmanimData = getZmanimForDate(date, location);

    // Format times for JSON response
    const formattedData = {
      ...zmanimData,
      zmanim: {
        alotHaShachar: formatZmanTime(zmanimData.zmanim.alotHaShachar, location.tzid),
        misheyakir: formatZmanTime(zmanimData.zmanim.misheyakir, location.tzid),
        sunrise: formatZmanTime(zmanimData.zmanim.sunrise, location.tzid),
        sofZmanShma: formatZmanTime(zmanimData.zmanim.sofZmanShma, location.tzid),
        sofZmanTfilla: formatZmanTime(zmanimData.zmanim.sofZmanTfilla, location.tzid),
        chatzot: formatZmanTime(zmanimData.zmanim.chatzot, location.tzid),
        minchaGedola: formatZmanTime(zmanimData.zmanim.minchaGedola, location.tzid),
        minchaKetana: formatZmanTime(zmanimData.zmanim.minchaKetana, location.tzid),
        plagHaMincha: formatZmanTime(zmanimData.zmanim.plagHaMincha, location.tzid),
        sunset: formatZmanTime(zmanimData.zmanim.sunset, location.tzid),
        tzait: formatZmanTime(zmanimData.zmanim.tzait, location.tzid),
        tzait72: formatZmanTime(zmanimData.zmanim.tzait72, location.tzid),
      },
      candleLighting: formatZmanTime(zmanimData.candleLighting, location.tzid),
      havdalah: formatZmanTime(zmanimData.havdalah, location.tzid),
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
