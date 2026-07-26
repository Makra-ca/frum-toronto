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
