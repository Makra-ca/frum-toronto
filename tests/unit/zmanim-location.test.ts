// tests/unit/zmanim-location.test.ts
import { describe, it, expect } from 'vitest';
import {
  TORONTO_LOCATION,
  roundCoord,
  isIsraelCountry,
  isTorontoLocation,
  serializeLocation,
  parseStoredLocation,
  buildZmanimParams,
  type ZmanimLocation,
} from '@/lib/zmanim-location';

const wasaga: ZmanimLocation = {
  lat: 44.5209, lon: -80.0177, tzid: 'America/Toronto',
  label: 'Wasaga Beach, ON', isIsrael: false,
};

describe('zmanim-location helpers', () => {
  it('TORONTO_LOCATION is the diaspora Toronto default', () => {
    expect(TORONTO_LOCATION.tzid).toBe('America/Toronto');
    expect(TORONTO_LOCATION.isIsrael).toBe(false);
    expect(Math.round(TORONTO_LOCATION.lat)).toBe(44);
  });

  it('isTorontoLocation matches the Toronto default and rejects others', () => {
    expect(isTorontoLocation(TORONTO_LOCATION)).toBe(true);
    expect(isTorontoLocation(wasaga)).toBe(false);
  });

  it('roundCoord clamps to 4 decimals', () => {
    expect(roundCoord(44.52091234)).toBe(44.5209);
    expect(roundCoord(-80.0177777)).toBe(-80.0178);
  });

  it('isIsraelCountry is case-insensitive on the IL code', () => {
    expect(isIsraelCountry('il')).toBe(true);
    expect(isIsraelCountry('IL')).toBe(true);
    expect(isIsraelCountry('ca')).toBe(false);
    expect(isIsraelCountry(undefined)).toBe(false);
  });

  it('serialize -> parse round-trips a location', () => {
    const parsed = parseStoredLocation(serializeLocation(wasaga));
    expect(parsed).toEqual(wasaga);
  });

  it('parseStoredLocation returns null on garbage / missing fields', () => {
    expect(parseStoredLocation('not json')).toBeNull();
    expect(parseStoredLocation(JSON.stringify({ lat: 1 }))).toBeNull();
    expect(parseStoredLocation(null)).toBeNull();
  });

  it('buildZmanimParams rounds coords and encodes the israel flag', () => {
    const p = buildZmanimParams(wasaga);
    expect(p.get('lat')).toBe('44.5209');
    expect(p.get('lon')).toBe('-80.0177');
    expect(p.get('tzid')).toBe('America/Toronto');
    expect(p.get('label')).toBe('Wasaga Beach, ON');
    expect(p.get('il')).toBe('0');
  });

  it('buildZmanimParams for Toronto default emits il=0', () => {
    expect(buildZmanimParams(TORONTO_LOCATION).get('il')).toBe('0');
  });
});
