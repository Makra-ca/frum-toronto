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
 *   - We round DIRECTIONALLY: deadlines down, permitted-from times up, so we
 *     never show more room than there is. MyZmanim rounds to the nearest minute,
 *     so a deadline can read one minute later there than here — by design.
 *   - hebcal rounds havdalah to the whole minute, so it can read one minute later
 *     than the tzeis row despite being the same moment.
 *   - Misheyakir now uses 10.2 degrees, matching MyZmanim's stated rule.
 */

import { getZmanimForDate } from "../src/lib/zmanim";
import { formatZmanByKey, type ZmanKey } from "../src/lib/zmanim-format";
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
const t = (key: ZmanKey, d: Date | null) =>
  formatZmanByKey(key, d, location.tzid) ?? "—";

const rows: Array<[string, string]> = [
  ["Date", r.date],
  ["Hebrew date", `${r.hebrewDate}  /  ${r.hebrewDateHebrew}`],
  ["Parsha", r.parsha ?? "—"],
  ["Special day", r.specialDay ?? "—"],
  ["", ""],
  ["Alos (dawn)", t("alotHaShachar", r.zmanim.alotHaShachar)],
  ["Misheyakir (10.2deg)", t("misheyakir", r.zmanim.misheyakir)],
  ["Sunrise / Hanetz", t("sunrise", r.zmanim.sunrise)],
  ["Sof Zman Shma (MGA 16.1)", t("sofZmanShmaMGA", r.zmanim.sofZmanShmaMGA)],
  ["Sof Zman Shma (GRA)", t("sofZmanShma", r.zmanim.sofZmanShma)],
  ["Sof Zman Tefila (MGA 16.1)", t("sofZmanTfillaMGA", r.zmanim.sofZmanTfillaMGA)],
  ["Sof Zman Tefila (GRA)", t("sofZmanTfilla", r.zmanim.sofZmanTfilla)],
  ["Chatzos", t("chatzot", r.zmanim.chatzot)],
  ["Mincha Gedola", t("minchaGedola", r.zmanim.minchaGedola)],
  ["Mincha Ketana", t("minchaKetana", r.zmanim.minchaKetana)],
  ["Plag HaMincha", t("plagHaMincha", r.zmanim.plagHaMincha)],
  ["Sunset / Shkiah", t("sunset", r.zmanim.sunset)],
  ["Nightfall, 3 stars (8.5deg)", t("tzait", r.zmanim.tzait)],
  ["Nightfall, 72 minutes", t("tzait72", r.zmanim.tzait72)],
  ["", ""],
  ["Candle lighting", formatZmanByKey("candleLighting", r.candleLighting, location.tzid) ?? "— (not erev Shabbos/YT)"],
  ["Havdalah (8.5deg)", formatZmanByKey("havdalah", r.havdalah, location.tzid) ?? "— (not motzei Shabbos/YT)"],
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
