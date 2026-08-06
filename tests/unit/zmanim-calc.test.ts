import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getZmanimForDate,
  getZmanimForWeek,
  getZmanimForRange,
  getUpcomingShabbat,
  formatZmanTime,
} from '@/lib/zmanim';
import { moladFootnotesInRange } from '@/lib/kiddush-levana';
import { formatZmanByKey } from '@/lib/zmanim-format';
import { TORONTO_LOCATION, type ZmanimLocation } from '@/lib/zmanim-location';

const miami: ZmanimLocation = {
  lat: 25.7617, lon: -80.1918, tzid: 'America/New_York',
  label: 'Miami, FL', isIsrael: false,
};
const jerusalem: ZmanimLocation = {
  lat: 31.7683, lon: 35.2137, tzid: 'Asia/Jerusalem',
  label: 'Jerusalem', isIsrael: true,
};

// A fixed, non-Yom-Tov weekday in summer.
const date = new Date('2026-07-14T12:00:00Z');

describe('getZmanimForDate is location-parameterized', () => {
  it('defaults to Toronto when no location passed (backward compatible)', () => {
    const r = getZmanimForDate(date);
    expect(r.zmanim.sunrise).toBeInstanceOf(Date);
  });

  it('produces a different sunset for Miami than Toronto on the same date', () => {
    const t = getZmanimForDate(date, TORONTO_LOCATION).zmanim.sunset.getTime();
    const m = getZmanimForDate(date, miami).zmanim.sunset.getTime();
    expect(m).not.toBe(t);
  });

  it('applies Israel rules for an Israeli location without throwing', () => {
    const r = getZmanimForDate(date, jerusalem);
    expect(r.zmanim.sunset).toBeInstanceOf(Date);
  });

  it('honors the il flag: 2nd day Shavuot is Yom Tov in diaspora but chol in Israel', () => {
    // 2026-05-23 is the 2nd day of Shavuot: Yom Tov in the diaspora (2-day
    // festival) but an ordinary weekday in Israel (1-day festival). If the
    // `il` flag were not wired through, both would report the same status.
    const yomTov2ndDayShavuot = new Date('2026-05-23T12:00:00Z');
    const diaspora = getZmanimForDate(yomTov2ndDayShavuot, TORONTO_LOCATION);
    const israel = getZmanimForDate(yomTov2ndDayShavuot, jerusalem);
    expect(diaspora.isYomTov).toBe(true);
    expect(israel.isYomTov).toBe(false);
  });
});

describe('tzait72 is a fixed 72 minutes after sunset (not degree-based)', () => {
  it('equals sunset + 72 clock minutes', () => {
    const r = getZmanimForDate(date, TORONTO_LOCATION);
    const diffMin = (r.zmanim.tzait72.getTime() - r.zmanim.sunset.getTime()) / 60000;
    expect(Math.round(diffMin)).toBe(72);
  });
});

describe('formatZmanTime respects the given timezone (regression for hardcoded Toronto)', () => {
  it('formats the same instant differently for two tzids with different offsets', () => {
    const instant = new Date('2026-07-14T12:00:00Z');
    const toronto = formatZmanTime(instant, 'America/Toronto');
    const jlem = formatZmanTime(instant, 'Asia/Jerusalem');
    expect(toronto).not.toBe(jlem);
    expect(toronto).toMatch(/AM|PM/);
  });

  it('returns --:-- for null', () => {
    expect(formatZmanTime(null, 'America/Toronto')).toBe('--:--');
  });
});

// ---------------------------------------------------------------------------
// Candle lighting / havdalah extraction.
//
// hebcal's getDesc() returns "Candle lighting" and "Havdalah" — the colon and
// the "(50 min)" suffix only appear in render(). Matching getDesc() against
// "Candle lighting:" therefore never fires, which left both fields permanently
// null on every surface of the site.
// ---------------------------------------------------------------------------

describe('candle lighting and havdalah are extracted from hebcal events', () => {
  // Friday 2026-07-24 and Saturday 2026-07-25, requested explicitly so this is
  // independent of how "today" is resolved.
  const erevShabbos = new Date('2026-07-24T12:00:00Z');
  const shabbos = new Date('2026-07-25T12:00:00Z');

  it('returns a candle lighting time on erev Shabbos', () => {
    const r = getZmanimForDate(erevShabbos, TORONTO_LOCATION);
    expect(r.candleLighting).toBeInstanceOf(Date);
    expect(formatZmanTime(r.candleLighting, TORONTO_LOCATION.tzid)).toBe('8:31 PM');
  });

  it('marks erev Shabbos as Shabbos rather than Yom Tov', () => {
    const r = getZmanimForDate(erevShabbos, TORONTO_LOCATION);
    expect(r.isShabbat).toBe(true);
    expect(r.isYomTov).toBe(false);
  });

  it('returns a havdalah time on Shabbos', () => {
    const r = getZmanimForDate(shabbos, TORONTO_LOCATION);
    expect(r.havdalah).toBeInstanceOf(Date);

    // Asserted through formatZmanByKey — the formatter the API and the page
    // actually use. formatZmanTime TRUNCATES and applies no rounding policy, so
    // asserting through it pinned the raw stored value rather than the rendered
    // one, and broke when the stored value legitimately changed.
    //
    // 8.5-degree nightfall, raw 9:38:34 PM, rounded UP because havdalah is a
    // permitted-from time. 9:39 PM is what the site displayed before this
    // assertion changed and what it displays now — the user-visible value is
    // unchanged. Was 9:38 PM under the older fixed `havdalahMins: 50`.
    expect(formatZmanByKey('havdalah', r.havdalah, TORONTO_LOCATION.tzid)).toBe('9:39 PM');
  });

  it('reports havdalah and tzeis as the same instant', () => {
    // Both are 8.5-degree nightfall, so they are one moment and must never
    // print as two. See tests/unit/zmanim-havdalah-consistency.test.ts.
    const r = getZmanimForDate(shabbos, TORONTO_LOCATION);
    expect(r.havdalah!.getTime()).toBe(r.zmanim.tzait.getTime());
  });

  it('returns no candle lighting on an ordinary weekday', () => {
    const tuesday = new Date('2026-07-21T12:00:00Z');
    const r = getZmanimForDate(tuesday, TORONTO_LOCATION);
    expect(r.candleLighting).toBeNull();
    expect(r.havdalah).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Day-boundary correctness (spec §11).
//
// Every calendar-day decision used to be made from the SERVER's local clock.
// On Vercel (UTC) that means from ~8 PM Toronto time the server's date has
// already rolled over, so the site reported tomorrow's Hebrew date, parsha and
// zmanim. These fixtures pin an instant that is Friday evening in Toronto but
// already Saturday in UTC.
// ---------------------------------------------------------------------------

// Friday 2026-07-24, 8:30 PM in Toronto === Saturday 2026-07-25, 00:30 UTC.
const fridayEveningToronto = new Date('2026-07-25T00:30:00Z');

describe('getZmanimForDate resolves "today" in the location, not on the server', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports Friday for a Toronto evening instant that is already Saturday in UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fridayEveningToronto);

    const r = getZmanimForDate(undefined, TORONTO_LOCATION);

    expect(r.hebrewDate).toContain('Av'); // 10 Av 5786 — not 11 Av (Shabbos)
    expect(r.candleLighting).not.toBeNull();
    expect(r.isShabbat).toBe(true); // Friday: candle lighting means erev Shabbos
    expect(r.isYomTov).toBe(false);
  });

  it('reports Saturday for the same instant in Jerusalem, where it genuinely is Saturday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fridayEveningToronto);

    const r = getZmanimForDate(undefined, jerusalem);

    expect(r.havdalah).not.toBeNull();
    expect(r.candleLighting).toBeNull();
    expect(r.isShabbat).toBe(true);
  });

  it('still honours an explicitly requested calendar date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fridayEveningToronto);

    // Asking for 1 Aug 2026 must return 1 Aug, not "today".
    const r = getZmanimForDate(new Date('2026-08-01T12:00:00Z'), TORONTO_LOCATION);

    expect(r.date).toContain('August 1, 2026');
  });
});

describe('getZmanimForWeek anchors every day at noon UTC', () => {
  it('returns seven consecutive days across the DST-end transition', () => {
    const week = getZmanimForWeek(new Date('2026-10-30T12:00:00Z'), TORONTO_LOCATION);

    expect(week).toHaveLength(7);
    expect(week[0].date).toContain('October 30, 2026');
    expect(week[6].date).toContain('November 5, 2026');
  });
});

describe('getUpcomingShabbat resolves from the location, not the server', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns THIS Shabbos on a Friday evening in Toronto, not next week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fridayEveningToronto);

    const s = getUpcomingShabbat(TORONTO_LOCATION);

    // Saturday 2026-07-25 is the Shabbos that starts on this very Friday night.
    expect(s.date.getUTCFullYear()).toBe(2026);
    expect(s.date.getUTCMonth()).toBe(6); // July
    expect(s.date.getUTCDate()).toBe(25);
    expect(s.candleLighting).not.toBeNull();
  });
});

describe('resolution is independent of the SERVER timezone', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
    vi.useRealTimers();
  });

  // Node re-reads process.env.TZ, so this genuinely relocates the "server".
  // Offsets are kept inside the documented safe interval [-12, +12).
  const serverZones = ['UTC', 'Asia/Tokyo', 'Asia/Kolkata', 'America/Toronto', 'America/Los_Angeles'];

  it('resolves the same Toronto civil day from every server timezone', () => {
    const results = serverZones.map((tz) => {
      process.env.TZ = tz;
      vi.useFakeTimers();
      vi.setSystemTime(fridayEveningToronto); // Fri 8:30 PM in Toronto
      const r = getZmanimForDate(undefined, TORONTO_LOCATION);
      vi.useRealTimers();
      return { tz, date: r.date, hebrew: r.hebrewDate, cl: r.candleLighting?.toISOString() ?? null };
    });

    // Every server timezone must agree it is Friday 24 July in Toronto.
    for (const r of results) {
      expect(r.date, `server TZ ${r.tz}`).toContain('July 24, 2026');
      expect(r.hebrew, `server TZ ${r.tz}`).toBe('10 Av 5786');
      expect(r.cl, `server TZ ${r.tz}`).toBe('2026-07-25T00:31:00.000Z');
    }

    // And they must agree with each other, not merely be individually plausible.
    expect(new Set(results.map((r) => r.date)).size).toBe(1);
  });

  it('resolves an explicit calendar date identically from every server timezone', () => {
    const dates = serverZones.map((tz) => {
      process.env.TZ = tz;
      return getZmanimForDate(new Date('2026-08-01T12:00:00Z'), TORONTO_LOCATION).date;
    });

    expect(new Set(dates).size).toBe(1);
    expect(dates[0]).toContain('August 1, 2026');
  });

  it('derives the same molad civil dates from every server timezone', () => {
    // Sh'vat 5793 is a ZERO-distance month: Rosh Chodesh falls on the same
    // weekday as the molad. HDate.greg() hands back LOCAL midnight, so on a
    // positive-offset server reading getUTCDate() off it lands one day earlier,
    // which turns the (dow - dow) % 7 == 0 case into a full SEVEN-day step back:
    // 2032-12-25 instead of 2033-01-01. Nothing else in the suite can see this,
    // because the unit project is pinned TZ=UTC.
    const results = serverZones.map((tz) => {
      process.env.TZ = tz;
      const f = moladFootnotesInRange(
        new Date(Date.UTC(2032, 11, 29, 12)),
        new Date(Date.UTC(2033, 0, 4, 12))
      );
      return { tz, days: f.map((x) => x.moladCivilDate.toISOString().slice(0, 10)) };
    });

    for (const r of results) {
      expect(r.days, `server TZ ${r.tz}`).toContain('2033-01-01');
    }

    // And identical to each other, not merely each individually plausible.
    expect(new Set(results.map((r) => r.days.join('|'))).size).toBe(1);
  });

  it('returns the same civil days from getZmanimForRange in every server timezone', () => {
    const results = serverZones.map((tz) => {
      process.env.TZ = tz;
      const rows = getZmanimForRange(
        new Date(Date.UTC(2026, 7, 1, 12)),
        new Date(Date.UTC(2026, 7, 5, 12)),
        TORONTO_LOCATION
      );
      return { tz, dates: rows.map((r) => r.date) };
    });

    for (const r of results) {
      expect(r.dates, `server TZ ${r.tz}`).toHaveLength(5);
      expect(r.dates[0], `server TZ ${r.tz}`).toContain('August 1, 2026');
      expect(r.dates[4], `server TZ ${r.tz}`).toContain('August 5, 2026');
    }

    expect(new Set(results.map((r) => r.dates.join('|'))).size).toBe(1);
  });
});
