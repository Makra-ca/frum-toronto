import { describe, it, expect, afterEach, vi } from 'vitest';
import { currentShabbos, listUpcomingShabbatot, isShabbosDate } from '@/lib/eruv/shabbos';
import { getUpcomingShabbat } from '@/lib/zmanim';
import { TORONTO_LOCATION } from '@/lib/zmanim-location';

// Toronto is UTC-4 (EDT) on these dates.
//   2026-08-07 Friday
//   2026-08-08 Saturday
//   2026-08-09 Sunday
const at = (iso: string) => new Date(iso);

describe('currentShabbos resolves the Shabbos in effect', () => {
  it('resolves a Sunday to the coming Saturday', () => {
    // Sun 2026-08-09, 10:00 AM Toronto
    expect(currentShabbos(at('2026-08-09T14:00:00Z'))).toBe('2026-08-15');
  });

  it.each([
    ['Monday', '2026-08-10T14:00:00Z'],
    ['Tuesday', '2026-08-11T14:00:00Z'],
    ['Wednesday', '2026-08-12T14:00:00Z'],
    ['Thursday', '2026-08-13T14:00:00Z'],
    ['Friday', '2026-08-14T14:00:00Z'],
  ])('resolves a %s to the coming Saturday', (_day, iso) => {
    expect(currentShabbos(at(iso))).toBe('2026-08-15');
  });

  // The whole point of not reusing getUpcomingShabbat.
  it('resolves a Saturday to ITSELF, not to next week', () => {
    // Sat 2026-08-08, 2:00 PM Toronto
    expect(currentShabbos(at('2026-08-08T18:00:00Z'))).toBe('2026-08-08');
  });

  it('differs from getUpcomingShabbat on a Saturday, which skips a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-08-08T18:00:00Z'));
    const upcoming = getUpcomingShabbat(TORONTO_LOCATION).date;
    vi.useRealTimers();

    // getUpcomingShabbat jumps to 2026-08-15; ours must stay on today.
    expect(upcoming.toISOString().slice(0, 10)).toBe('2026-08-15');
    expect(currentShabbos(at('2026-08-08T18:00:00Z'))).toBe('2026-08-08');
  });
});

describe('currentShabbos rolls over at midnight Toronto', () => {
  it('treats Friday 11:59 PM and Saturday 12:01 AM as the same Shabbos', () => {
    const fridayLate = currentShabbos(at('2026-08-08T03:59:00Z')); // Fri 11:59 PM EDT
    const saturdayEarly = currentShabbos(at('2026-08-08T04:01:00Z')); // Sat 12:01 AM EDT
    expect(fridayLate).toBe('2026-08-08');
    expect(saturdayEarly).toBe('2026-08-08');
  });

  it('still shows the finished Shabbos late on Saturday night', () => {
    // Sat 2026-08-08, 11:59 PM Toronto -- after havdalah, before midnight.
    expect(currentShabbos(at('2026-08-09T03:59:00Z'))).toBe('2026-08-08');
  });

  it('moves to the next Shabbos just after midnight on Sunday', () => {
    // Sun 2026-08-09, 12:01 AM Toronto
    expect(currentShabbos(at('2026-08-09T04:01:00Z'))).toBe('2026-08-15');
  });
});

describe('currentShabbos is independent of the SERVER timezone', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  // Node re-reads process.env.TZ, so this genuinely relocates the "server".
  const serverZones = ['UTC', 'Asia/Tokyo', 'Asia/Kolkata', 'America/Toronto', 'America/Los_Angeles'];

  // The instant MUST be a Saturday evening in Toronto, not a Friday evening.
  // A UTC server misreads a Toronto Friday evening as Saturday -- but
  // Friday -> coming Saturday and Saturday -> itself resolve to the SAME date,
  // so the misread still produces the right answer and the test passes against
  // broken code. Saturday evening is the instant where the misread rolls to
  // Sunday and actually changes the result.
  it('agrees from every server timezone on a Saturday evening in Toronto', () => {
    // Sat 2026-08-08, 8:30 PM Toronto -> 2026-08-09T00:30Z. A UTC server reads
    // this as Sunday and would answer 2026-08-15.
    const instant = at('2026-08-09T00:30:00Z');

    const results = serverZones.map((tz) => {
      process.env.TZ = tz;
      return { tz, shabbos: currentShabbos(instant) };
    });

    for (const r of results) {
      expect(r.shabbos, `server TZ ${r.tz}`).toBe('2026-08-08');
    }
  });

  it('agrees from every server timezone on a Friday evening in Toronto', () => {
    // Fri 2026-08-07, 8:30 PM Toronto. Weaker than the case above on its own,
    // kept because it is the realistic moment someone checks before Shabbos.
    const instant = at('2026-08-08T00:30:00Z');

    for (const tz of serverZones) {
      process.env.TZ = tz;
      expect(currentShabbos(instant), `server TZ ${tz}`).toBe('2026-08-08');
    }
  });
});

describe('listUpcomingShabbatot', () => {
  it('returns the requested number of Saturdays in ascending order', () => {
    const list = listUpcomingShabbatot(at('2026-08-07T14:00:00Z'), 5);

    expect(list).toHaveLength(5);
    expect(list.map((o) => o.date)).toEqual([
      '2026-08-08',
      '2026-08-15',
      '2026-08-22',
      '2026-08-29',
      '2026-09-05',
    ]);
  });

  it('starts from the Shabbos currently in effect', () => {
    // On Saturday itself, that Saturday is still the first option -- the admin
    // must be able to correct today's status.
    const list = listUpcomingShabbatot(at('2026-08-08T18:00:00Z'), 3);
    expect(list[0].date).toBe('2026-08-08');
  });

  it('labels every entry with a non-empty parsha', () => {
    const list = listUpcomingShabbatot(at('2026-08-07T14:00:00Z'), 4);
    for (const option of list) {
      expect(option.label, option.date).toBeTruthy();
    }
  });
});

describe('isShabbosDate', () => {
  it('accepts a Saturday', () => {
    expect(isShabbosDate('2026-08-08')).toBe(true);
  });

  it.each(['2026-08-07', '2026-08-09', '2026-08-11'])('rejects %s', (date) => {
    expect(isShabbosDate(date)).toBe(false);
  });

  // Must not throw, and must not accept. A malformed date reaching the write
  // path used to 500 rather than 400.
  it.each(['not-a-date', '', '2026-13-45', '2026/08/08', '08-08-2026'])(
    'rejects malformed input %j without throwing',
    (input) => {
      expect(isShabbosDate(input)).toBe(false);
    },
  );

  // Read as a plain calendar date, never shifted into the server's timezone.
  it('does not depend on the server timezone', () => {
    const originalTz = process.env.TZ;
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      expect(isShabbosDate('2026-08-08'), `server TZ ${tz}`).toBe(true);
      expect(isShabbosDate('2026-08-09'), `server TZ ${tz}`).toBe(false);
    }
    process.env.TZ = originalTz;
  });
});
