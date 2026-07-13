import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPlaces, reverseGeocode } from '@/lib/geocode';

function photonFeature(overrides = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-80.0177, 44.5209] }, // [lon, lat]
    properties: { name: 'Wasaga Beach', state: 'Ontario', country: 'Canada', countrycode: 'CA' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('searchPlaces', () => {
  it('maps a Photon FeatureCollection to trimmed results', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [photonFeature()] }), { status: 200 }),
    );
    const results = await searchPlaces('wasaga');
    expect(results[0]).toMatchObject({ lat: 44.5209, lon: -80.0177, countryCode: 'CA' });
    expect(results[0].label).toContain('Wasaga Beach');
    expect(results[0].label).toContain('Canada');
  });

  it('returns [] for a blank query without calling fetch', async () => {
    const spy = vi.spyOn(global, 'fetch');
    expect(await searchPlaces('  ')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('throws on a non-OK response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('err', { status: 500 }));
    await expect(searchPlaces('wasaga')).rejects.toThrow();
  });
});

describe('reverseGeocode', () => {
  it('returns a single labeled place with country code', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [photonFeature({ properties: { name: 'Jerusalem', country: 'Israel', countrycode: 'IL' } })],
      }), { status: 200 }),
    );
    const r = await reverseGeocode(31.7683, 35.2137);
    expect(r).toMatchObject({ countryCode: 'IL' });
    expect(r?.label).toContain('Jerusalem');
  });

  it('returns null when there are no features', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 }),
    );
    expect(await reverseGeocode(0, 0)).toBeNull();
  });
});
