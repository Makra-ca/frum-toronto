import type { Metadata } from "next";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { parseMonthParam } from "@/lib/zmanim-month-param";
import { parseLocationParamsOrToronto } from "@/lib/zmanim-location-params";
import { ZmanimSheet } from "./ZmanimSheet";
import "./print.css";

// Redundant while next.config.ts has no cacheComponents, and deliberately so:
// it keeps "today" from being frozen at build time even if Cache Components is
// enabled later. Only this segment is affected — the week view at /zmanim stays
// static, which is the reason the sheet is its own route.
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** searchParams is a Promise in Next 15+; this flattens the awaited value. */
function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") p.set(k, v);
    else if (Array.isArray(v) && v[0]) p.set(k, v[0]);
  }
  return p;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SP;
}): Promise<Metadata> {
  const params = toParams(await searchParams);
  const location = parseLocationParamsOrToronto(params);
  const { from } = parseMonthParam(params.get("month"), location);
  // timeZone: "UTC" because the range is anchored at noon UTC — see
  // src/lib/zmanim-day.ts. Formatting it in any other zone can shift the month.
  const label = from.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    title: `Zmanim Calendar — ${label} — ${location.label}`,
    description: `Printable monthly zmanim calendar for ${location.label}: ${label}.`,
  };
}

export default async function ZmanimMonthPage({ searchParams }: { searchParams: SP }) {
  const params = toParams(await searchParams);
  const location = parseLocationParamsOrToronto(params);
  const range = parseMonthParam(params.get("month"), location);
  const lines = buildSheetLines(range.from, range.to, location);

  return <ZmanimSheet lines={lines} range={range} location={location} />;
}
