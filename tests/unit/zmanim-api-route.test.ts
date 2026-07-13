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

  it('computes for a valid custom location', async () => {
    const res = await GET(req('?lat=25.7617&lon=-80.1918&tzid=America/New_York&label=Miami&il=0'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zmanim.sunset).toMatch(/AM|PM/);
  });
});
