// src/lib/zmanim-location.ts
export interface ZmanimLocation {
  lat: number;
  lon: number;
  tzid: string;   // IANA timezone id
  label: string;  // human-readable place name
  isIsrael: boolean;
}

export const TORONTO_LOCATION: ZmanimLocation = {
  lat: 43.6629,
  lon: -79.3957,
  tzid: 'America/Toronto',
  label: 'Toronto, ON',
  isIsrael: false,
};

export function roundCoord(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function isIsraelCountry(countryCode: string | undefined | null): boolean {
  return (countryCode ?? '').toLowerCase() === 'il';
}

export function serializeLocation(loc: ZmanimLocation): string {
  return JSON.stringify(loc);
}

export function parseStoredLocation(raw: string | null): ZmanimLocation | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (
      typeof o?.lat === 'number' &&
      typeof o?.lon === 'number' &&
      typeof o?.tzid === 'string' && o.tzid.length > 0 &&
      typeof o?.label === 'string' &&
      typeof o?.isIsrael === 'boolean'
    ) {
      return { lat: o.lat, lon: o.lon, tzid: o.tzid, label: o.label, isIsrael: o.isIsrael };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildZmanimParams(loc: ZmanimLocation): URLSearchParams {
  const p = new URLSearchParams();
  p.set('lat', String(roundCoord(loc.lat)));
  p.set('lon', String(roundCoord(loc.lon)));
  p.set('tzid', loc.tzid);
  p.set('label', loc.label);
  p.set('il', loc.isIsrael ? '1' : '0');
  return p;
}
