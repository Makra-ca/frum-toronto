// One parser, two honest contracts:
//   parseLocationParams          -> { location } | { error }   (API: error becomes a 400)
//   parseLocationParamsOrToronto -> ZmanimLocation             (page: always renders)
//
// The page contract cannot be the API's. A page that 400s on a stale bookmark
// shows a blank error; it must fall back and render.
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

/** Is this a timezone Intl actually knows? Non-empty is NOT enough. */
function isValidTimeZone(tzid: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid });
    return true;
  } catch {
    return false;
  }
}

export function parseLocationParams(
  searchParams: URLSearchParams,
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

  if (tzidParam === null || tzidParam.trim().length === 0 || !isValidTimeZone(tzidParam)) {
    return { error: "Invalid or missing 'tzid' (must be a valid IANA timezone id)" };
  }

  return {
    location: {
      lat,
      lon,
      tzid: tzidParam,
      label: searchParams.get("label") || "Selected location",
      isIsrael: searchParams.get("il") === "1",
    },
  };
}

/** Page contract: any problem degrades to Toronto so the sheet always renders. */
export function parseLocationParamsOrToronto(searchParams: URLSearchParams): ZmanimLocation {
  const parsed = parseLocationParams(searchParams);
  return "location" in parsed ? parsed.location : TORONTO_LOCATION;
}
