// src/lib/kiddush-levana.ts
//
// Both inline footnote lines the old sheet printed. This is the ONLY module
// that constructs `Molad` or `HDate` for them, so the constructor trap below
// has exactly one home.
import { HDate, Molad } from "@hebcal/core";
import { anchorCalendarDate } from "@/lib/zmanim-day";

/** One chelek = 1/1080 of an hour = 3⅓ seconds. */
const CHELEK_MS = 3_600_000 / 1080;

/**
 * Half a lunar month, as the old site reckoned it.
 *
 * Encoded LITERALLY as 14d 18h 22m + 1 chelek. Do NOT "simplify" this to half
 * of 29d 12h 44m 3⅓c — that is 14d 18h 22m 1.667s, which is 1.67s different and
 * no longer reproduces the published "Friday 2:37 AM".
 */
const SOF_ZMAN_OFFSET_MS = ((14 * 24 + 18) * 60 + 22) * 60_000 + CHELEK_MS;

export interface MoladFootnotes {
  monthName: string;
  moladCivilDate: Date;
  moladLine: string;
  sofZmanCivilDate: Date;
  sofZmanLine: string;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clockLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

/**
 * Civil date of the molad: from Rosh Chodesh, walk back 0-6 days to the molad's
 * weekday.
 *
 * ZERO IS A REAL CASE — about 1 month in 28. Reading this as "the PRECEDING
 * occurrence" goes back a full seven days and prints the footnote a week early.
 */
function moladCivilDate(roshChodesh: HDate, moladDow: number): Date {
  // anchorCalendarDate FIRST. HDate.greg() returns LOCAL midnight, so reading
  // getUTCDate() off it shifts a day on any positive-offset machine — measured:
  // in Asia/Tokyo and Pacific/Auckland the zero-distance months come out a FULL
  // WEEK early (Sh'vat 5793 -> 2032-12-25 instead of 2033-01-01). The unit
  // project is pinned TZ=UTC, so no test would ever catch this; it bites only a
  // developer's machine. This is exactly what src/lib/zmanim-day.ts exists for.
  const rc = anchorCalendarDate(roshChodesh.greg());
  const back = (rc.getUTCDay() - moladDow + 7) % 7;
  return new Date(Date.UTC(rc.getUTCFullYear(), rc.getUTCMonth(), rc.getUTCDate() - back, 12));
}

/** Every footnote whose date falls inside [from, to], in date order. */
export function moladFootnotesInRange(from: Date, to: Date): MoladFootnotes[] {
  const out: MoladFootnotes[] = [];

  // Widen by a lunar month at each end: a molad before `from` can still put its
  // sof zman inside the range, and vice versa.
  const scanFrom = new HDate(new Date(from.getTime() - 31 * 86_400_000));
  const scanTo = new HDate(new Date(to.getTime() + 31 * 86_400_000));

  for (let hy = scanFrom.getFullYear(); hy <= scanTo.getFullYear(); hy++) {
    const monthsInYear = HDate.monthsInYear(hy);
    for (let hm = 1; hm <= monthsInYear; hm++) {
      // (year, month) — both NUMBERS. Passing an HDate as the first argument
      // produces NaN internally; on @hebcal/core 6.9.1 that surfaces as
      // `TypeError: HDate called with bad arg: NaN` from calculateMolad rather
      // than silent garbage, but it is still the wrong call and older versions
      // are not guaranteed to be as loud.
      const molad = new Molad(hy, hm);
      const rc = new HDate(1, hm, hy);
      const monthName = rc.getMonthName();

      const civil = moladCivilDate(rc, molad.getDow());
      const moladInstant = new Date(
        civil.getTime() - 12 * 3_600_000 + molad.getHour() * 3_600_000 + molad.getMinutes() * 60_000
      );
      const sofZman = new Date(moladInstant.getTime() + SOF_ZMAN_OFFSET_MS);

      const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
      const sofZmanCivil = new Date(
        Date.UTC(sofZman.getUTCFullYear(), sofZman.getUTCMonth(), sofZman.getUTCDate(), 12)
      );
      if (!inRange(civil) && !inRange(sofZmanCivil)) continue;

      const monthLabel = civil.toLocaleDateString("en-US", {
        month: "long", day: "numeric", timeZone: "UTC",
      });

      out.push({
        monthName,
        moladCivilDate: civil,
        // The molad time is stated in the traditional fixed reckoning and is
        // deliberately NOT converted to the viewer's timezone. hebcal prints
        // 8:15am and so did the old ASP site, in Toronto. This is the only time
        // on the whole sheet that is intentionally not local.
        moladLine:
          `The Molad for ${monthName} will take place: ${DOW[molad.getDow()]} ` +
          `${clockLabel(moladInstant)} + ${molad.getChalakim()} Chalakim - ${monthLabel}`,
        sofZmanCivilDate: sofZmanCivil,
        sofZmanLine:
          `Sof Zman Kiddush Levanoh: ${DOW[sofZman.getUTCDay()]} ` +
          `${clockLabel(sofZman)} + ${molad.getChalakim()} Chalakim`,
      });
    }
  }

  return out.sort((a, b) => a.moladCivilDate.getTime() - b.moladCivilDate.getTime());
}
