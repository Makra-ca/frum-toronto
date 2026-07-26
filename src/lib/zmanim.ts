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
  misheyakir: Date;
  sunrise: Date;
  sofZmanShma: Date;
  sofZmanTfilla: Date;
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
    havdalahMins: 50, // 50 minutes after sunset for Havdalah
  });

  let parsha: string | null = null;
  let specialDay: string | null = null;
  let candleLighting: Date | null = null;
  let havdalah: Date | null = null;
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
    if (desc.startsWith("Havdalah")) {
      if (ev instanceof TimedEvent) {
        havdalah = ev.eventTime || null;
      }
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
    misheyakir: zmanim.misheyakir(),
    sunrise: zmanim.sunrise(),
    sofZmanShma: zmanim.sofZmanShma(), // GRA / Vilna Gaon
    sofZmanTfilla: zmanim.sofZmanTfilla(), // GRA / Vilna Gaon
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
