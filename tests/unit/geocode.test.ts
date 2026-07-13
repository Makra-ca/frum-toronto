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

  it('dedupes features that render to the same label', async () => {
    // Photon often returns a city node AND a boundary relation with identical
    // properties -> identical label. The user sees one row, not two.
    const jlemProps = { name: 'Jerusalem', state: 'Jerusalem District', country: 'Israel', countrycode: 'IL' };
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [
          photonFeature({ geometry: { type: 'Point', coordinates: [35.2137, 31.7683] }, properties: jlemProps }),
          photonFeature({ geometry: { type: 'Point', coordinates: [35.2100, 31.7700] }, properties: jlemProps }),
          photonFeature({ properties: { name: 'Wasaga Beach', state: 'Ontario', country: 'Canada', countrycode: 'CA' } }),
        ],
      }), { status: 200 }),
    );
    const results = await searchPlaces('jerus');
    const jlem = results.filter((r) => r.label === 'Jerusalem, Jerusalem District, Israel');
    expect(jlem).toHaveLength(1);
    expect(results).toHaveLength(2); // one Jerusalem + one Wasaga
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
