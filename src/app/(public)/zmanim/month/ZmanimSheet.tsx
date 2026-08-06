// Presentation only. Every line, its order, and every footnote is decided by
// buildSheetLines(); this file maps over SheetLine[] and switches on `kind`.
// It contains NO date arithmetic and makes NO halachic decision. Times are
// formatted exclusively through formatZmanByKey, which applies the per-zman
// rounding direction — never format a Date here.
import Link from "next/link";
import { formatZmanByKey, type ZmanKey } from "@/lib/zmanim-format";
import type { ZmanimTimes } from "@/lib/zmanim";
import type { SheetLine } from "@/lib/zmanim-sheet";
import type { MonthRange } from "@/lib/zmanim-month-param";
import type { ZmanimLocation } from "@/lib/zmanim-location";
import { MonthPicker } from "./MonthPicker";

// Only the per-day zmanim, not candleLighting — that has its own column.
// columns and live beside `zmanim`, not inside it.
type TimesKey = keyof ZmanimTimes & ZmanKey;

/**
 * Every heading carries its shita inline. There is no rabbinic review step on
 * this sheet, and it is printed and pinned to a wall away from the site, so a
 * number that does not say which opinion it represents is not publishable.
 */
// Each heading is split into a label and its SHITA, stacked on two lines.
//
// The shita staying visible is mandatory — there is no rabbinic review on this
// sheet, so a printed number has to say which opinion it represents. But on one
// line the headings, not the times, set the column widths: "Sof Zman Shema (Gra)"
// measured 130px against 60px of actual data, and 21 such columns overflowed the
// printed page and clipped. Stacking keeps the shita and lets the column size to
// its content. The old sheet did exactly this.
const ZMAN_COLUMNS: { key: TimesKey; heading: string; shita: string }[] = [
  { key: "alotHaShachar", heading: "Alos", shita: "16.1°" },
  { key: "alotHaShachar72", heading: "Alos", shita: "72 min" },
  { key: "misheyakir", heading: "Misheyakir", shita: "10.2°" },
  { key: "misheyakir45", heading: "Misheyakir", shita: "45 min" },
  { key: "sunrise", heading: "Netz", shita: "Sunrise" },
  { key: "sofZmanShmaMGA", heading: "Sof Zman Shema", shita: "MA" },
  { key: "sofZmanShma", heading: "Sof Zman Shema", shita: "Gra" },
  { key: "sofZmanTfillaMGA", heading: "Sof Zman Tefilah", shita: "MA" },
  { key: "sofZmanTfilla", heading: "Sof Zman Tefilah", shita: "Gra" },
  { key: "chatzot", heading: "Chatzos", shita: "" },
  { key: "minchaGedola", heading: "Mincha", shita: "Gedola" },
  { key: "minchaKetana", heading: "Mincha", shita: "Ketana" },
  { key: "plagHaMincha", heading: "Plag", shita: "HaMincha" },
  { key: "sunset", heading: "Shkia", shita: "Sunset" },
  { key: "tzait", heading: "Tzeis", shita: "8.5°" },
  { key: "tzait72", heading: "Tzeis", shita: "72 min" },
];

// 3 identity columns + the zmanim + candle lighting + notes.
//
// There is deliberately NO Havdalah column. Since src/lib/zmanim.ts made
// `havdalah` the SAME Date object as `tzait` (commit e78c6dc), a Havdalah
// column would print a value byte-identical to Tzeis 8.5° on every row it
// appeared — the same number twice under two headings, on a chart where
// horizontal space is the scarce resource. The old sheet had no such column
// either. The legend explains the relationship instead.
// Derived rather than written as a literal, so a column added above cannot
// leave the footnote rows short and break the table's row structure.
const COLUMN_COUNT = 3 + ZMAN_COLUMNS.length + 2;

// Sticky left identity block. On a table this wide the scanning failure is
// horizontal — scroll to Tzeis and the row you are reading is anonymous — so
// the day/date/Hebrew-date cells pin to the left edge. The offsets have to be
// stated in pixels because sticky cannot infer them from earlier columns.
const COL_DAY_W = 44;
const COL_DATE_W = 44;
const COL_HEB_W = 92;
const STICKY_LEFT = [0, COL_DAY_W, COL_DAY_W + COL_DATE_W];
const STICKY_W = [COL_DAY_W, COL_DATE_W, COL_HEB_W];

function stickyCell(index: number): React.CSSProperties {
  return {
    position: "sticky",
    left: STICKY_LEFT[index],
    minWidth: STICKY_W[index],
    width: STICKY_W[index],
  };
}

/** Anchored at noon UTC by zmanim-day.ts, so UTC is the only correct zone here. */
function fmtDate(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function ZmanimSheet({
  lines,
  range,
  location,
}: {
  lines: SheetLine[];
  range: MonthRange;
  location: ZmanimLocation;
}) {
  const monthLabel = fmtDate(range.from, { month: "long", year: "numeric" });
  const caption = `Zmanim for ${monthLabel} — ${location.label}`;

  return (
    <div className="zmanim-sheet-print container mx-auto px-4 py-8">
      <div className="no-print mb-6">
        <Link href="/zmanim" className="text-sm text-blue-600 hover:underline">
          ← Weekly zmanim
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          Zmanim Calendar — {monthLabel}
        </h1>
      </div>

      {/* The spec's core control. page.tsx renders only this component, so the
          picker reaches the page from here or not at all. */}
      <MonthPicker range={range} location={location} />

      <div
        className="overflow-x-auto min-w-0 max-w-full border border-gray-200 rounded-lg"
        tabIndex={0}
        role="region"
        aria-label="Zmanim table, scrolls horizontally"
      >
        <table className="w-full border-collapse text-xs">
          <caption className="px-3 py-2 text-left text-sm font-medium text-gray-700">
            {caption}
          </caption>
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr>
              <th
                scope="col"
                style={{ ...stickyCell(0), zIndex: 30 }}
                className="bg-gray-100 border-b border-r border-gray-200 px-1 py-2 text-left font-semibold text-gray-800"
              >
                Day
              </th>
              <th
                scope="col"
                style={{ ...stickyCell(1), zIndex: 30 }}
                className="bg-gray-100 border-b border-r border-gray-200 px-1 py-2 text-left font-semibold text-gray-800"
              >
                Date
              </th>
              <th
                scope="col"
                style={{ ...stickyCell(2), zIndex: 30 }}
                className="bg-gray-100 border-b border-r border-gray-200 px-1 py-2 text-left font-semibold text-gray-800"
              >
                Hebrew
              </th>
              {ZMAN_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="border-b border-gray-200 px-1 py-2 text-right align-bottom font-semibold text-gray-800"
                >
                  <span className="block leading-tight">{c.heading}</span>
                  {c.shita && (
                    <span className="block text-[11px] font-normal leading-tight text-gray-500 print:text-[6.5pt]">
                      {c.shita}
                    </span>
                  )}
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-gray-200 px-1 py-2 text-right align-bottom font-semibold text-gray-800"
              >
                <span className="block leading-tight">Candle</span>
                <span className="block leading-tight">Lighting</span>
              </th>
              <th
                scope="col"
                className="border-b border-gray-200 px-2 py-2 text-left font-semibold text-gray-800"
              >
                Notes / Daf Yomi
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              if (line.kind === "footnote") {
                return (
                  <tr key={`f-${i}`} className="bg-amber-50">
                    <td
                      colSpan={COLUMN_COUNT}
                      className="border-b border-gray-200 px-3 py-1 text-[11px] italic text-gray-700"
                    >
                      {line.text}
                    </td>
                  </tr>
                );
              }

              const notes = [...line.labels, line.dafYomi]
                .filter((s): s is string => Boolean(s))
                .join(" · ");
              const rowBg = line.isToday ? "bg-blue-50" : "bg-white";

              return (
                <tr
                  key={`d-${i}`}
                  // No ring/outline: with border-collapse a <tr> has no box of
                  // its own to draw on. Background and weight are what actually
                  // render, on screen and on paper.
                  className={`${rowBg} ${line.isToday ? "font-semibold" : ""}`}
                >
                  <td
                    style={stickyCell(0)}
                    className={`${rowBg} border-b border-r border-gray-200 px-1 py-1 text-gray-700`}
                  >
                    {fmtDate(line.date, { weekday: "short" })}
                  </td>
                  <th
                    scope="row"
                    style={stickyCell(1)}
                    className={`${rowBg} border-b border-r border-gray-200 px-1 py-1 text-left font-medium text-gray-900`}
                  >
                    {fmtDate(line.date, { day: "numeric" })}
                  </th>
                  <td
                    style={stickyCell(2)}
                    className={`${rowBg} border-b border-r border-gray-200 px-1 py-1 whitespace-nowrap text-gray-700`}
                  >
                    {line.hebrewDateShort}
                  </td>
                  {ZMAN_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className="border-b border-gray-200 px-2 py-1 text-right tabular-nums whitespace-nowrap text-gray-900"
                    >
                      {formatZmanByKey(c.key, line.zmanim.zmanim[c.key], location.tzid) ?? ""}
                    </td>
                  ))}
                  <td className="border-b border-gray-200 px-2 py-1 text-right tabular-nums whitespace-nowrap text-orange-700">
                    {formatZmanByKey("candleLighting", line.zmanim.candleLighting, location.tzid) ?? ""}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1 text-gray-700">{notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend and disclaimer. This MUST print: a pinned sheet of unexplained
          times with nothing saying which opinion they follow, and no
          instruction to check with a rav, is the worst outcome here. The print
          stylesheet force-shows .sheet-legend. */}
      <div className="sheet-legend mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">About These Zmanim</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Times are calculated for {location.label} ({location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°)</li>
          <li>• Sof Zman Shma and Tefila are shown for both the GRA (Vilna Gaon) and the Magen Avraham, whose day is measured from 16.1°</li>
          <li>• Misheyakir is when the sun is 10.2° below the horizon</li>
          <li>• Nightfall is 8.5° below the horizon (&ldquo;three stars&rdquo;); the 72-minute custom is listed separately</li>
          <li>• Candle lighting follows the local custom — 18 minutes before sunset in most places, 40 in Jerusalem, 30 in Haifa</li>
          <li>• Havdalah uses the same 8.5° nightfall as above</li>
          <li>
            • Times are rounded to the stringent side: deadlines down, earliest
            times up. Comparing with myzmanim.com you may see a one-minute
            difference — that is deliberate, so a time is never shown as later
            than it really is.
          </li>
          <li>• Always verify times with your local Rabbi</li>
        </ul>
      </div>
    </div>
  );
}
