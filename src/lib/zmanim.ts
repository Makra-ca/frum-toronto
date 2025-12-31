import { HDate, Location, Zmanim, HebrewCalendar, flags } from "@hebcal/core";

// Toronto coordinates
const TORONTO_LAT = 43.6629;
const TORONTO_LON = -79.3957;
const TORONTO_TIMEZONE = "America/Toronto";

// Create Toronto location
export const torontoLocation = new Location(
  TORONTO_LAT,
  TORONTO_LON,
  false, // not in Israel
  TORONTO_TIMEZONE,
  "Toronto, ON",
  "CA"
);

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
export function getZmanimForDate(date: Date = new Date()): ZmanimResponse {
  const zmanim = new Zmanim(torontoLocation, date, false);
  const hdate = new HDate(date);

  // Get Hebrew date string
  const hebrewDate = hdate.toString(); // e.g., "17 Kislev 5785"
  const hebrewDateHebrew = hdate.renderGematriya(); // Hebrew letters

  // Get parsha and special days
  const events = HebrewCalendar.calendar({
    start: date,
    end: date,
    location: torontoLocation,
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

    // Check for candle lighting
    if (desc.startsWith("Candle lighting:")) {
      candleLighting = ev.eventTime || null;
      // If there's candle lighting, it's either Friday or Yom Tov eve
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 5) {
        isShabbat = true;
      } else {
        isYomTov = true;
      }
    }

    // Check for Havdalah
    if (desc.startsWith("Havdalah:") || desc.startsWith("Havdalah (")) {
      havdalah = ev.eventTime || null;
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
  if (date.getDay() === 6) {
    isShabbat = true;
  }

  // Calculate all zmanim times
  const zmanimTimes: ZmanimTimes = {
    alotHaShachar: zmanim.alotHaShachar(),
    misheyakir: zmanim.misheyakir(),
    sunrise: zmanim.sunrise(),
    sofZmanShma: zmanim.sofZmanShma(), // Magen Avraham
    sofZmanTfilla: zmanim.sofZmanTfilla(), // Magen Avraham
    chatzot: zmanim.chatzot(),
    minchaGedola: zmanim.minchaGedola(),
    minchaKetana: zmanim.minchaKetana(),
    plagHaMincha: zmanim.plagHaMincha(),
    sunset: zmanim.sunset(),
    tzait: zmanim.tzeit(8.5), // 8.5 degrees - standard tzait
    tzait72: zmanim.tzeit(16.1), // Approximately 72 minutes
  };

  // Format the English date
  const englishDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TORONTO_TIMEZONE,
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
export function getZmanimForWeek(startDate: Date = new Date()): ZmanimResponse[] {
  const week: ZmanimResponse[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    week.push(getZmanimForDate(date));
  }

  return week;
}

/**
 * Format a time for display (e.g., "7:45 AM")
 */
export function formatZmanTime(date: Date | null | undefined): string {
  if (!date) return "--:--";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TORONTO_TIMEZONE,
  });
}

/**
 * Get the upcoming Shabbat times
 */
export function getUpcomingShabbat(): {
  candleLighting: Date | null;
  havdalah: Date | null;
  parsha: string | null;
  date: Date;
} {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Calculate days until Friday
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6;

  const friday = new Date(today);
  friday.setDate(friday.getDate() + daysUntilFriday);

  const saturday = new Date(friday);
  saturday.setDate(saturday.getDate() + 1);

  const fridayZmanim = getZmanimForDate(friday);
  const saturdayZmanim = getZmanimForDate(saturday);

  return {
    candleLighting: fridayZmanim.candleLighting,
    havdalah: saturdayZmanim.havdalah,
    parsha: saturdayZmanim.parsha || fridayZmanim.parsha,
    date: saturday,
  };
}
