import { anchorCivilDate, civilDateInTimeZone } from "@/lib/zmanim-day";
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
    // An explicit `date` param is a CALENDAR DATE, so it is read in **UTC** and
    // re-anchored — never in location.tzid, which would shift it (a Toronto
    // viewer picking Aug 1 sends 2026-08-01T16:00:00Z, which is Aug 2 in
    // Pacific/Auckland). Clients serialise a mid-day local anchor for exactly
    // this reason; see ZmanimPageContent.
    // When absent we pass `undefined` so the library resolves "today" in the
    // location rather than on the server.
    const parsedDateParam = dateParam ? new Date(dateParam) : null;
    const date =
      parsedDateParam && !Number.isNaN(parsedDateParam.getTime())
        ? anchorCivilDate(civilDateInTimeZone(parsedDateParam, "UTC"))
        : undefined;

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
    // Computed once; feeds both the upcoming ISO time and the upcoming parsha.
    const upcomingShabbat = getUpcomingShabbat(location);

    // Format times for JSON response
    const formattedData = {
      ...zmanimData,
      zmanim: {
        alotHaShachar: formatZmanTime(zmanimData.zmanim.alotHaShachar, location.tzid),
        misheyakir: formatZmanTime(zmanimData.zmanim.misheyakir, location.tzid),
        sunrise: formatZmanTime(zmanimData.zmanim.sunrise, location.tzid),
        sofZmanShma: formatZmanTime(zmanimData.zmanim.sofZmanShma, location.tzid),
        sofZmanTfilla: formatZmanTime(zmanimData.zmanim.sofZmanTfilla, location.tzid),
        sofZmanShmaMGA: formatZmanTime(zmanimData.zmanim.sofZmanShmaMGA, location.tzid),
        sofZmanTfillaMGA: formatZmanTime(zmanimData.zmanim.sofZmanTfillaMGA, location.tzid),
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

      // Raw ISO values for machine consumers (the homepage hero).
      //
      // The formatted fields above cannot express absence: formatZmanTime(null)
      // returns the string "--:--", which is TRUTHY, so a caller cannot tell "no
      // candle lighting today" from a real time. These are null when there is no
      // such zman, and are what resolvePrimaryZman() consumes.
      //
      // `upcoming` is always relative to NOW, never to the `date` param —
      // getUpcomingShabbat() calls new Date() internally.
      candleLightingISO: zmanimData.candleLighting?.toISOString() ?? null,
      havdalahISO: zmanimData.havdalah?.toISOString() ?? null,
      upcomingCandleLightingISO: upcomingShabbat.candleLighting?.toISOString() ?? null,
      // The coming Shabbos's parsha, for weekdays where `parsha` above is null.
      // Computed for the REQUESTED location, because the diaspora and Israel
      // readings diverge for a few weeks after a Yom Tov that falls on Shabbos.
      upcomingParsha: upcomingShabbat.parsha ?? null,
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
