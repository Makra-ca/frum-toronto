import { HDate, Location, Zmanim, HebrewCalendar, flags, TimedEvent } from "@hebcal/core";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";
import {
  anchorCalendarDate,
  todayInLocation,
  addAnchoredDays,
} from "@/lib/zmanim-day";

/**
 * Build a @hebcal/core Location from a ZmanimLocation.
 */
function toHebcalLocation(loc: ZmanimLocation): Location {
  return new Location(
    loc.lat,
    loc.lon,
    loc.isIsrael,
    loc.tzid,
    loc.label,
    loc.isIsrael ? "IL" : undefined,
  );
}

export interface ZmanimTimes {
  alotHaShachar: Date;
  /** Fixed 72 clock minutes before sunrise (not degree-based). */
  alotHaShachar72: Date;
  misheyakir: Date;
  /** Fixed 45 clock minutes before sunrise. */
  misheyakir45: Date;
  sunrise: Date;
  sofZmanShma: Date;
  sofZmanTfilla: Date;
  /** Magen Avraham, day measured from 16.1 degrees ("72 minutes as degrees"). */
  sofZmanShmaMGA: Date;
  sofZmanTfillaMGA: Date;
  chatzot: Date;
  minchaGedola: Date;
  minchaKetana: Date;
  plagHaMincha: Date;
  sunset: Date;
  tzait: Date;
  tzait72: Date;
}

export interface ZmanimResponse {
  date: string;
  hebrewDate: string;
  hebrewDateHebrew: string;
  parsha: string | null;
  specialDay: string | null;
  zmanim: ZmanimTimes;
  candleLighting: Date | null;
  havdalah: Date | null;
  isShabbat: boolean;
  isYomTov: boolean;
}

/**
 * Get zmanim for a specific date in Toronto
 */
export function getZmanimForDate(
  date?: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): ZmanimResponse {
  // Which civil day are we computing? `date` given => that calendar date;
  // omitted => "today" as observed in `location`. See src/lib/zmanim-day.ts for
  // why both are anchored at noon UTC before touching hebcal.
  const dayDate = date ? anchorCalendarDate(date) : todayInLocation(location);

  const hebcalLoc = toHebcalLocation(location);
  const zmanim = new Zmanim(hebcalLoc, dayDate, false);
  const hdate = new HDate(dayDate);

  // Get Hebrew date string
  const hebrewDate = hdate.toString(); // e.g., "17 Kislev 5785"
  const hebrewDateHebrew = hdate.renderGematriya(); // Hebrew letters

  // Get parsha and special days
  const events = HebrewCalendar.calendar({
    start: dayDate,
    end: dayDate,
    location: hebcalLoc,
    il: location.isIsrael, // Israel rules (1-day Yom Tov)
    sedrot: true,
    candlelighting: true,
    // Havdalah at 8.5 degrees of solar depression ("three small stars"), which
    // is the same definition MyZmanim publishes as "Nightfall - 3 stars emerge /
    // 36 minutes as degrees", and the same value the tzait row above uses — so
    // the site no longer shows two different nightfall times for one moment.
    //
    // This replaced a fixed `havdalahMins: 50`. A fixed offset cannot track the
    // seasons: it ran up to ~8 minutes later than 8.5 degrees in March and ~2
    // minutes later in January. See tests/unit/zmanim-havdalah.test.ts.
    //
    // If a rav specifies a different shiur, this is the ONE place to change it:
    // `havdalahMins: 72` for the stringent 72-clock-minute custom (the site
    // already displays that separately as tzait72), or `havdalahDeg: 7.083` for
    // three medium-sized stars.
    havdalahDeg: 8.5,
  });

  let parsha: string | null = null;
  let specialDay: string | null = null;
  let candleLighting: Date | null = null;
  // Whether hebcal emits a Havdalah for this day. The TIME is not taken from
  // the event — see where `havdalah` is assigned below.
  let hasHavdalah = false;
  let isShabbat = false;
  let isYomTov = false;

  for (const ev of events) {
    const desc = ev.getDesc();

    // Check for parsha
    if (desc.startsWith("Parashat ")) {
      parsha = desc.replace("Parashat ", "");
    }

    // Check for candle lighting.
    // NOTE: match without a colon. hebcal's getDesc() returns "Candle lighting";
    // the colon and time ("Candle lighting: 8:31pm") only appear in render().
    // Matching "Candle lighting:" here silently left this field null forever.
    if (desc.startsWith("Candle lighting")) {
      if (ev instanceof TimedEvent) {
        candleLighting = ev.eventTime || null;
      }
      // If there's candle lighting, it's either Friday or Yom Tov eve
      const dayOfWeek = dayDate.getUTCDay();
      if (dayOfWeek === 5) {
        isShabbat = true;
      } else {
        isYomTov = true;
      }
    }

    // Check for Havdalah. getDesc() is plain "Havdalah"; the "(50 min)" suffix
    // and the time only appear in render(). Same defect as candle lighting.
    //
    // Only the EXISTENCE of a havdalah is taken from the event. Its time comes
    // from tzait below.
    if (desc.startsWith("Havdalah")) {
      hasHavdalah = true;
    }

    // Check for special days (holidays, fast days)
    const mask = ev.getFlags();
    if (mask & flags.CHAG) {
      specialDay = desc;
      isYomTov = true;
    } else if (mask & flags.MINOR_HOLIDAY) {
      specialDay = desc;
    } else if (mask & flags.MINOR_FAST || mask & flags.MAJOR_FAST) {
      specialDay = desc;
    }
  }

  // Check if it's Shabbat (Saturday)
  if (dayDate.getUTCDay() === 6) {
    isShabbat = true;
  }

  // Calculate all zmanim times
  const zmanimTimes: ZmanimTimes = {
    alotHaShachar: zmanim.alotHaShachar(),
    alotHaShachar72: zmanim.alotHaShachar72(),
    // 10.2 degrees below the horizon, matching the rule MyZmanim publishes for
    // this row ("Sun is 10.2 degrees below horizon"). hebcal's misheyakir()
    // default is 11.5 degrees, which ran ~9.5 minutes earlier.
    misheyakir: zmanim.timeAtAngle(10.2, true),
    // sunriseOffset's second argument is named `roundMinute` but TRUNCATES
    // seconds. Passing `true` hands roundZman a value already at :00, so its
    // "up" direction silently never applies and this prints a minute EARLY —
    // on an earliest-permitted time. Keep `false`; roundZman owns rounding.
    misheyakir45: zmanim.sunriseOffset(-45, false),
    sunrise: zmanim.sunrise(),
    sofZmanShma: zmanim.sofZmanShma(), // GRA / Vilna Gaon
    sofZmanTfilla: zmanim.sofZmanTfilla(), // GRA / Vilna Gaon
    // Magen Avraham: the halachic day runs from alos to tzeis at 16.1 degrees,
    // so these fall earlier than the GRA equivalents. MyZmanim lists the same
    // pair as "72 minutes as 16.1 degrees".
    sofZmanShmaMGA: zmanim.sofZmanShmaMGA16Point1(),
    sofZmanTfillaMGA: zmanim.sofZmanTfillaMGA16Point1(),
    chatzot: zmanim.chatzot(),
    minchaGedola: zmanim.minchaGedola(),
    minchaKetana: zmanim.minchaKetana(),
    plagHaMincha: zmanim.plagHaMincha(),
    sunset: zmanim.sunset(),
    tzait: zmanim.tzeit(8.5), // 8.5 degrees - standard tzait
    // Fixed 72 minutes after sunset (clock minutes, same all year) — matches the
    // common "72 minutes" tzeis. NOT a degree-based value.
    tzait72: new Date(zmanim.sunset().getTime() + 72 * 60 * 1000),
  };

  // Havdalah IS tzeis 8.5° — `havdalahDeg: 8.5` is what hebcal was asked to use,
  // and `zmanimTimes.tzait` above is that same calculation. So take the same
  // Date object rather than hebcal's event time, which arrives pre-rounded to
  // the NEAREST minute.
  //
  // Verified across all 54 havdalah events in 2026: hebcal's event is never more
  // than 30 s from tzeit(8.5) — exactly the rounding error and nothing more — so
  // this substitutes the same moment on every occurrence, Yom Tov included.
  //
  // That pre-rounding was a real bug, not a nicety. `roundZman` returns early
  // when a value already sits at :00 seconds, so the "up" direction registered
  // for havdalah never applied to it, while `tzait` — carrying real seconds —
  // was rounded up as intended. On five of ten consecutive Saturdays the two
  // rows of the same week card printed different minutes for the one moment.
  //
  // Sharing the Date makes them equal by construction, not by coincidence.
  // See tests/unit/zmanim-havdalah-consistency.test.ts.
  const havdalah: Date | null = hasHavdalah ? zmanimTimes.tzait : null;

  // Format the English date. `dayDate` is anchored at noon UTC and already
  // represents the intended civil day, so it is formatted in UTC — converting
  // it through location.tzid would re-introduce a shift for large positive
  // offsets (noon UTC is the next day at +12).
  const englishDate = dayDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return {
    date: englishDate,
    hebrewDate,
    hebrewDateHebrew,
    parsha,
    specialDay,
    zmanim: zmanimTimes,
    candleLighting,
    havdalah,
    isShabbat,
    isYomTov,
  };
}

/**
 * Get zmanim for multiple days (e.g., for a weekly view)
 */
export function getZmanimForWeek(
  startDate?: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): ZmanimResponse[] {
  const base = startDate ? anchorCalendarDate(startDate) : todayInLocation(location);
  const week: ZmanimResponse[] = [];

  for (let i = 0; i < 7; i++) {
    // addAnchoredDays, not setDate: UTC has no DST, so every day stays pinned at
    // exactly noon UTC instead of drifting an hour across a transition.
    week.push(getZmanimForDate(addAnchoredDays(base, i), location));
  }

  return week;
}

/**
 * Format a time for display (e.g., "7:45 AM")
 */
export function formatZmanTime(date: Date | null | undefined, tzid: string): string {
  if (!date) return "--:--";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tzid,
  });
}

/**
 * Get the upcoming Shabbat times
 */
export function getUpcomingShabbat(
  location: ZmanimLocation = TORONTO_LOCATION,
): {
  candleLighting: Date | null;
  havdalah: Date | null;
  parsha: string | null;
  date: Date;
} {
  // "Today" as observed in `location`, not on the server. Before this, a Friday
  // 8:30 PM visit in Toronto read as Saturday on a UTC server and skipped to the
  // following week's Shabbos.
  const today = todayInLocation(location);
  const dayOfWeek = today.getUTCDay();

  // Calculate days until Friday
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6;

  const friday = addAnchoredDays(today, daysUntilFriday);
  const saturday = addAnchoredDays(friday, 1);

  const fridayZmanim = getZmanimForDate(friday, location);
  const saturdayZmanim = getZmanimForDate(saturday, location);

  return {
    candleLighting: fridayZmanim.candleLighting,
    havdalah: saturdayZmanim.havdalah,
    parsha: saturdayZmanim.parsha || fridayZmanim.parsha,
    date: saturday,
  };
}

/**
 * Every label applicable to a date: Yom Tov, Rosh Chodesh, fast days, Chol
 * Hamoed.
 *
 * `ZmanimResponse.specialDay` cannot serve the sheet: it omits
 * flags.ROSH_CHODESH entirely, and it is a single last-write-wins string, so a
 * day that is both Rosh Chodesh and Chanukah collapses to one arbitrary label.
 * It is left exactly as-is because the week view and the API consume it.
 */
export function labelsForDate(
  date: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): string[] {
  const dayDate = anchorCalendarDate(date);
  const events = HebrewCalendar.calendar({
    start: dayDate,
    end: dayDate,
    location: toHebcalLocation(location),
    il: location.isIsrael,
    sedrot: false,
    candlelighting: false,
  });

  const WANTED =
    flags.CHAG |
    flags.ROSH_CHODESH |
    flags.MINOR_FAST |
    flags.MAJOR_FAST |
    flags.MINOR_HOLIDAY |
    flags.CHOL_HAMOED;

  const labels: string[] = [];
  for (const ev of events) {
    if (ev.getFlags() & WANTED) {
      const desc = ev.getDesc();
      if (!labels.includes(desc)) labels.push(desc);
    }
  }
  return labels;
}

/**
 * Zmanim for every civil day in [from, to], inclusive.
 *
 * Uses addAnchoredDays rather than setDate so each day stays pinned at exactly
 * 12:00 UTC — a DST transition inside the range must not duplicate or skip a
 * civil day.
 */
export function getZmanimForRange(
  from: Date,
  to: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): ZmanimResponse[] {
  const start = anchorCalendarDate(from);
  const end = anchorCalendarDate(to);
  if (end.getTime() < start.getTime()) return [];

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const out: ZmanimResponse[] = [];
  for (let i = 0; i <= days; i++) {
    out.push(getZmanimForDate(addAnchoredDays(start, i), location));
  }
  return out;
}
