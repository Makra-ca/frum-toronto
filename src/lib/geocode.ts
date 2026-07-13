/**
 * Client-side helper around the Photon geocoder (photon.komoot.io).
 * Turns a typed place name into coordinates + country, and reverse-geocodes
 * coordinates into a readable label. Called from the browser (LocationPicker).
 */

const PHOTON_BASE = "https://photon.komoot.io";

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  countryCode: string;
}

interface PhotonProperties {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/**
 * Compose a readable label from the place parts, in order
 * [name, city, state, country], dropping empties and consecutive duplicates.
 */
function buildLabel(props: PhotonProperties): string {
  const parts = [props.name, props.city, props.state, props.country];
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    if (out.length > 0 && out[out.length - 1] === trimmed) continue;
    out.push(trimmed);
  }
  return out.join(", ");
}

/**
 * Search Photon for places matching a query. Returns up to 6 results.
 * A blank query returns [] without hitting the network.
 */
export async function searchPlaces(
  q: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const query = q.trim();
  if (!query) return [];

  const res = await fetch(
    `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Photon search failed: ${res.status}`);
  }

  const data: PhotonResponse = await res.json();
  const features = data.features ?? [];

  return features.map((feature) => {
    const props = feature.properties ?? {};
    const [lon, lat] = feature.geometry?.coordinates ?? [0, 0];
    return {
      label: buildLabel(props),
      lat,
      lon,
      countryCode: props.countrycode ?? "",
    };
  });
}

/**
 * Reverse-geocode coordinates into a label + country code.
 * Returns null when Photon has no feature for the point.
 * Coordinates are NOT returned — the caller already has lat/lon.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ label: string; countryCode: string } | null> {
  const res = await fetch(
    `${PHOTON_BASE}/reverse?lat=${lat}&lon=${lon}&lang=en`,
  );
  if (!res.ok) {
    throw new Error(`Photon reverse failed: ${res.status}`);
  }

  const data: PhotonResponse = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;

  const props = feature.properties ?? {};
  return {
    label: buildLabel(props),
    countryCode: props.countrycode ?? "",
  };
}
