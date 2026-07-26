// tests/unit/zmanim-api-route.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/zmanim/route';

function req(qs: string) {
  return new Request(`http://localhost/api/zmanim${qs}`);
}

describe('GET /api/zmanim location params', () => {
  it('defaults to Toronto with no params', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zmanim.sunrise).toMatch(/AM|PM/);
  });

  it('returns 400 on out-of-range latitude', async () => {
    const res = await GET(req('?lat=999&lon=0&tzid=America/Toronto'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing tzid when lat/lon present', async () => {
    const res = await GET(req('?lat=25.76&lon=-80.19'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on empty-string coordinates', async () => {
    const res = await GET(req('?lat=&lon=&tzid=America/Toronto'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on out-of-range longitude', async () => {
    expect((await GET(req('?lat=0&lon=999&tzid=America/Toronto'))).status).toBe(400);
  });

  it('returns 400 when only latitude is provided', async () => {
    expect((await GET(req('?lat=25.76&tzid=America/Toronto'))).status).toBe(400);
  });

  it('returns 400 on non-numeric coordinates', async () => {
    expect((await GET(req('?lat=abc&lon=def&tzid=America/Toronto'))).status).toBe(400);
  });

  it('a custom location produces different times than Toronto', async () => {
    const toronto = await (await GET(req(''))).json();
    const tokyo = await (await GET(req('?lat=35.6762&lon=139.6503&tzid=Asia/Tokyo&label=Tokyo&il=0'))).json();
    expect(tokyo.zmanim.sunrise).not.toBe(toronto.zmanim.sunrise);
  });

  it('computes for a valid custom location', async () => {
    const res = await GET(req('?lat=25.7617&lon=-80.1918&tzid=America/New_York&label=Miami&il=0'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zmanim.sunset).toMatch(/AM|PM/);
  });
});

describe('GET /api/zmanim date param is a calendar date (spec §11)', () => {
  it('honours an explicit date sent as a mid-day local anchor', async () => {
    // What ZmanimPageContent actually serialises: a local-noon Date via
    // toISOString(). For a UTC-4 viewer picking 1 Aug that is 16:00Z.
    const res = await GET(req('?date=2026-08-01T16:00:00.000Z'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toContain('August 1, 2026');
  });

  it('does not shift the requested date for a far-positive-offset location', async () => {
    // Read in location.tzid instead of UTC, 2026-08-01T16:00Z would be 2 Aug in
    // Auckland. The date param must be location-independent.
    const res = await GET(
      req('?date=2026-08-01T16:00:00.000Z&lat=-36.85&lon=174.76&tzid=Pacific/Auckland')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toContain('August 1, 2026');
  });

  it('falls back to today when the date param is unparseable', async () => {
    const res = await GET(req('?date=not-a-date'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toMatch(/\d{4}/);
  });

  it('returns a real candle-lighting time for an erev Shabbos date', async () => {
    // Regression guard for the getDesc() colon defect: this was "--:--" for
    // every date on every surface of the site.
    const res = await GET(req('?date=2026-07-24T12:00:00.000Z'));
    const body = await res.json();
    expect(body.candleLighting).toBe('8:31 PM');
    expect(body.candleLighting).not.toBe('--:--');
  });
});

describe('GET /api/zmanim ISO fields for the hero (spec §3)', () => {
  it('exposes raw ISO values alongside the formatted ones on erev Shabbos', async () => {
    const res = await GET(req('?date=2026-07-24T12:00:00.000Z'));
    const body = await res.json();

    // Formatted values stay exactly as they were, for existing consumers.
    expect(body.candleLighting).toBe('8:31 PM');
    // ISO values are machine-readable and never the "--:--" sentinel.
    expect(body.candleLightingISO).toBe('2026-07-25T00:31:00.000Z');
    expect(body.havdalahISO).toBeNull();
    expect(body.upcomingCandleLightingISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns null ISO values on an ordinary weekday, never "--:--"', async () => {
    const res = await GET(req('?date=2026-07-21T12:00:00.000Z'));
    const body = await res.json();

    expect(body.candleLighting).toBe('--:--');       // legacy formatted field
    expect(body.candleLightingISO).toBeNull();        // the field the hero reads
    expect(body.havdalahISO).toBeNull();
    // The weekday fallback: there is always an upcoming Shabbos.
    expect(body.upcomingCandleLightingISO).not.toBeNull();
  });

  it('gives havdalah an ISO value on Shabbos', async () => {
    const res = await GET(req('?date=2026-07-25T12:00:00.000Z'));
    const body = await res.json();
    expect(body.havdalahISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.candleLightingISO).toBeNull();
  });

  it('computes upcomingCandleLightingISO for the requested location, not Toronto', async () => {
    const toronto = await (await GET(req('?date=2026-07-21T12:00:00.000Z'))).json();
    const jerusalem = await (
      await GET(req('?date=2026-07-21T12:00:00.000Z&lat=31.7683&lon=35.2137&tzid=Asia/Jerusalem&il=1'))
    ).json();
    expect(jerusalem.upcomingCandleLightingISO).not.toBe(toronto.upcomingCandleLightingISO);
  });
});
