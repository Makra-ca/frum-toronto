/**
 * Print our computed zmanim in the same row order MyZmanim uses, so a human can
 * diff the two side by side in a few seconds.
 *
 *   npm run zmanim:verify                            # Toronto, today
 *   npm run zmanim:verify -- 2026-12-25              # Toronto, a given date
 *   npm run zmanim:verify -- 2026-12-25 jerusalem
 *
 * (Runs through vite-node via npx — no new dependency. tsx cannot resolve
 * @hebcal/core's package exports, and vitest.config.mts supplies the aliases.
 * First run downloads vite-node; needs network once.)
 *
 * Why a print-and-compare script rather than a scraper: MyZmanim publishes no
 * API, and screen-scraping their HTML would break silently and quietly start
 * "passing". The unit tests pin the DEFINITIONS (8.5 degrees for tzeis and
 * havdalah, sunset+72 fixed minutes for tzait72) plus a golden day; this script
 * is for periodic human spot-checks against the live site, especially after a
 * @hebcal/core upgrade.
 *
 * Compare against:
 *   https://www.myzmanim.com/search.aspx?q=toronto
 *
 * Known, expected differences:
 *   - MyZmanim ROUNDS to the nearest minute; formatZmanTime TRUNCATES. A 6:05:42
 *     sunrise shows as 6:05 here and 6:06 there.
 *   - hebcal rounds havdalah to the whole minute, so it can read one minute later
 *     than the tzeis row despite being the same moment.
 *   - Misheyakir uses hebcal's default degrees, not MyZmanim's 10.2.
 */

import { getZmanimForDate, formatZmanTime } from "../src/lib/zmanim";
import { TORONTO_LOCATION, type ZmanimLocation } from "../src/lib/zmanim-location";
import { anchorCivilDate } from "../src/lib/zmanim-day";

const LOCATIONS: Record<string, ZmanimLocation> = {
  toronto: TORONTO_LOCATION,
  jerusalem: {
    lat: 31.7683,
    lon: 35.2137,
    tzid: "Asia/Jerusalem",
    label: "Jerusalem, Israel",
    isIsrael: true,
  },
};

const [dateArg, locArg = "toronto"] = process.argv.slice(2);

const location = LOCATIONS[locArg.toLowerCase()];
if (!location) {
  console.error(`Unknown location "${locArg}". Known: ${Object.keys(LOCATIONS).join(", ")}`);
  process.exit(1);
}

let date: Date | undefined;
if (dateArg) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateArg);
  if (!m) {
    console.error(`Bad date "${dateArg}". Use YYYY-MM-DD.`);
    process.exit(1);
  }
  date = anchorCivilDate({ year: +m[1], month: +m[2], day: +m[3] });
}

const r = getZmanimForDate(date, location);
const t = (d: Date | null) => formatZmanTime(d, location.tzid);

const rows: Array<[string, string]> = [
  ["Date", r.date],
  ["Hebrew date", `${r.hebrewDate}  /  ${r.hebrewDateHebrew}`],
  ["Parsha", r.parsha ?? "—"],
  ["Special day", r.specialDay ?? "—"],
  ["", ""],
  ["Alos (dawn)", t(r.zmanim.alotHaShachar)],
  ["Misheyakir", `${t(r.zmanim.misheyakir)}   <- hebcal default degrees, not MyZmanim 10.2`],
  ["Sunrise / Hanetz", t(r.zmanim.sunrise)],
  ["Sof Zman Shma (GRA)", t(r.zmanim.sofZmanShma)],
  ["Sof Zman Tefila (GRA)", t(r.zmanim.sofZmanTfilla)],
  ["Chatzos", t(r.zmanim.chatzot)],
  ["Mincha Gedola", t(r.zmanim.minchaGedola)],
  ["Mincha Ketana", t(r.zmanim.minchaKetana)],
  ["Plag HaMincha", t(r.zmanim.plagHaMincha)],
  ["Sunset / Shkiah", t(r.zmanim.sunset)],
  ["Nightfall, 3 stars (8.5deg)", t(r.zmanim.tzait)],
  ["Nightfall, 72 minutes", t(r.zmanim.tzait72)],
  ["", ""],
  ["Candle lighting", r.candleLighting ? t(r.candleLighting) : "— (not erev Shabbos/YT)"],
  ["Havdalah (8.5deg)", r.havdalah ? t(r.havdalah) : "— (not motzei Shabbos/YT)"],
];

console.log(`\n  ${location.label} — server TZ ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`);
for (const [label, value] of rows) {
  if (!label) {
    console.log("");
    continue;
  }
  console.log(`  ${label.padEnd(30)} ${value}`);
}
console.log(`\n  Compare: https://www.myzmanim.com/search.aspx?q=${encodeURIComponent(location.label.split(",")[0])}\n`);
