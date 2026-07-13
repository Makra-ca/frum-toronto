import { describe, it, expect } from 'vitest';
import { getZmanimForDate, formatZmanTime } from '@/lib/zmanim';
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
