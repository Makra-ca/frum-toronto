# Zmanim Location Picker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "view zmanim for another place" control (search by place name or "use my location") to the `/zmanim` page and homepage widget, defaulting to Toronto, with no database change and no login.

**Architecture:** The `@hebcal/core` engine already computes zmanim from any coordinates — it is only ever handed Toronto today. We parameterize the calculation layer by a `ZmanimLocation`, add a server-side geocode proxy (Nominatim) so users pick a *place name*, resolve the timezone client-side with `tz-lookup`, thread location params through `/api/zmanim`, and build a shared `LocationPicker` used by both consumers. Chosen location persists in `localStorage`.

**Tech Stack:** Next.js (App Router), `@hebcal/core` (existing), `tz-lookup` (new, offline coords→IANA tz), Nominatim/OpenStreetMap (free geocoder, no key), Vitest (`node` env, `tests/unit/**`).

**Spec:** `docs/superpowers/specs/2026-07-13-zmanim-location-picker-design.md`

---

## File Structure

**New files:**
- `src/lib/zmanim-location.ts` — `ZmanimLocation` type, `TORONTO_LOCATION` constant, pure helpers: `roundCoord`, `isIsraelCountry`, `serializeLocation`/`parseStoredLocation` (localStorage), `buildZmanimParams` (URLSearchParams for `/api/zmanim`).
- `src/app/api/zmanim/geocode/route.ts` — GET proxy to Nominatim: `?q=` (search) and `?lat=&lon=` (reverse). Returns trimmed results.
- `src/components/zmanim/LocationPicker.tsx` — shared client component (search + GPS + reset), `compact` flag for the widget.
- Test files under `tests/unit/`: `zmanim-location.test.ts`, `zmanim-calc.test.ts`, `zmanim-geocode-route.test.ts`, `zmanim-api-route.test.ts`.

**Modified files:**
- `src/lib/zmanim.ts` — parameterize all functions by `ZmanimLocation`; fix hardcoded-timezone formatting.
- `src/app/api/zmanim/route.ts` — accept `lat`/`lon`/`tzid`/`label`/`il` params; thread `tzid` into formatting for `today`/`week`.
- `src/app/(public)/zmanim/ZmanimPageContent.tsx` — render full picker; drive fetch off active location; dynamic copy.
- `src/components/widgets/ZmanimWidget.tsx` — render compact picker; include active-location params in fetch.
- `package.json` — add `tz-lookup`.

---

## Chunk 1: Calculation layer + location helpers + APIs

### Task 1: Add `tz-lookup` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install tz-lookup
```
Expected: installs cleanly; `tz-lookup` appears in `dependencies`.

`tz-lookup` ships **no bundled types and there is no `@types/tz-lookup` on npm** — this is the expected case, not an edge case. Add a one-line ambient declaration so `tsc` is happy (create `src/types/tz-lookup.d.ts`):
```ts
declare module 'tz-lookup' {
  export default function tzlookup(lat: number, lon: number): string;
}
```

- [ ] **Step 2: Verify it resolves a known coordinate**

Run:
```bash
node -e "console.log(require('tz-lookup')(31.7683, 35.2137))"
```
Expected: prints `Asia/Jerusalem` (proves offline coords→tz works).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tz-lookup for coordinate-to-timezone resolution"
```

---

### Task 2: `zmanim-location.ts` — types and pure helpers

**Files:**
- Create: `src/lib/zmanim-location.ts`
- Test: `tests/unit/zmanim-location.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-location.test.ts
import { describe, it, expect } from 'vitest';
import {
  TORONTO_LOCATION,
  roundCoord,
  isIsraelCountry,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- zmanim-location`
Expected: FAIL — module `@/lib/zmanim-location` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- zmanim-location`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim-location.ts tests/unit/zmanim-location.test.ts
git commit -m "feat: zmanim location types and pure helpers"
```

---

### Task 3: Parameterize `zmanim.ts` by location + fix timezone formatting

**Files:**
- Modify: `src/lib/zmanim.ts`
- Test: `tests/unit/zmanim-calc.test.ts`

**Context / gotchas:**
- Today every function uses the module-level `torontoLocation` and `TORONTO_TIMEZONE`.
- `formatZmanTime` (`zmanim.ts:177-186`) and the English date (`zmanim.ts:137-143`) hardcode `America/Toronto` — the core bug.
- `@hebcal/core` `Location` constructor: `new Location(lat, lon, isIsrael, tzid, cityName, countryCode)`.
- Israel rules per the approved spec: pass `il: location.isIsrael` to `HebrewCalendar.calendar(...)`, and set `candleLightingMins: location.isIsrael ? 40 : 18` (40 = the PM-approved Israel/Jerusalem custom). **Verify** the option name/behavior against the installed `@hebcal/core` version before finalizing the expected values in Step 1 (the design flagged this as "confirm, don't assume").

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-calc.test.ts
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
});

// NOTE (intentional deviation from spec's test list): the spec lists asserting
// "Jerusalem → 1-day Yom Tov + 40-min candle lighting on a Yom Tov date" as a
// unit test. Exact candle-lighting times are timezone/DST-brittle, so that
// specific assertion is verified LIVE in Task 10 Step 2 instead of here. The
// unit test only proves Israel locations compute without error. This is a
// deliberate choice, not a dropped requirement.

describe('formatZmanTime respects the given timezone (regression for hardcoded Toronto)', () => {
  it('formats the same instant differently for Toronto vs Miami tzid', () => {
    // Toronto (EDT, -4) and Miami (EDT, -4) share an offset in summer, so use a
    // pair with different offsets: Toronto vs Jerusalem.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- zmanim-calc`
Expected: FAIL — `getZmanimForDate` ignores 2nd arg and/or `formatZmanTime` ignores tzid arg.

- [ ] **Step 3: Implement — parameterize + fix formatting**

In `src/lib/zmanim.ts`:
1. Import the shared type/default: `import { TORONTO_LOCATION, type ZmanimLocation } from '@/lib/zmanim-location';`
2. Add a helper to build a hebcal `Location` from a `ZmanimLocation`:
```ts
function toHebcalLocation(loc: ZmanimLocation): Location {
  return new Location(
    loc.lat, loc.lon, loc.isIsrael, loc.tzid,
    loc.label, loc.isIsrael ? 'IL' : undefined,
  );
}
```
3. Change signatures:
   - `getZmanimForDate(date: Date = new Date(), location: ZmanimLocation = TORONTO_LOCATION)`
   - `getZmanimForWeek(startDate: Date = new Date(), location: ZmanimLocation = TORONTO_LOCATION)` — pass `location` through to each `getZmanimForDate` call.
   - `getUpcomingShabbat(location: ZmanimLocation = TORONTO_LOCATION)` — pass through to its internal `getZmanimForDate` calls.
4. In `getZmanimForDate`, build `const hebcalLoc = toHebcalLocation(location);` and use it for both `new Zmanim(hebcalLoc, date, false)` and `HebrewCalendar.calendar({ ..., location: hebcalLoc, il: location.isIsrael, candleLightingMins: location.isIsrael ? 40 : 18, havdalahMins: 50 })`.
5. Replace the English date's `timeZone: TORONTO_TIMEZONE` with `timeZone: location.tzid`.
6. Change `formatZmanTime(date, tzid)` to take the timezone:
```ts
export function formatZmanTime(date: Date | null | undefined, tzid: string): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tzid,
  });
}
```
Keep `torontoLocation` and `TORONTO_TIMEZONE` exports if referenced elsewhere; grep `grep -rn "TORONTO_TIMEZONE\|torontoLocation" src` and update callers (only `zmanim.ts` and `route.ts` should use them).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- zmanim-calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim.ts tests/unit/zmanim-calc.test.ts
git commit -m "feat: parameterize zmanim by location, fix hardcoded-timezone formatting"
```

---

### Task 4: `/api/zmanim` accepts location params

**Files:**
- Modify: `src/app/api/zmanim/route.ts`
- Test: `tests/unit/zmanim-api-route.test.ts`

**Context:**
- The route currently calls `formatZmanTime(x)` with one arg everywhere — update each call to pass the resolved `tzid`.
- Parse a `ZmanimLocation` from query params; if `lat`/`lon`/`tzid` absent → `TORONTO_LOCATION`.
- Validate: `lat` finite in [-90,90], `lon` finite in [-180,180], `tzid` non-empty → else 400.
- `il` param: `"1"` → true, else false. `label` optional (fallback to `"Selected location"`).
- `mode=shabbat` intentionally stays Toronto (no consumer uses it); leave that branch as-is but update its `formatZmanTime` calls to pass `TORONTO_LOCATION.tzid` so the signature change compiles.

- [ ] **Step 1: Write the failing test**

```ts
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

  it('computes for a valid custom location', async () => {
    const res = await GET(req('?lat=25.7617&lon=-80.1918&tzid=America/New_York&label=Miami&il=0'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zmanim.sunset).toMatch(/AM|PM/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- zmanim-api-route`
Expected: FAIL — route ignores params / 400 cases not handled / signature mismatch.

- [ ] **Step 3: Implement param parsing + threading**

Add a `parseLocation(searchParams)` helper in the route returning `{ location: ZmanimLocation } | { error: string }`, use `TORONTO_LOCATION` default, validate ranges, and replace every `formatZmanTime(x)` with `formatZmanTime(x, location.tzid)` in the `today` and `week` branches. Pass `location` into `getZmanimForDate(date, location)` / `getZmanimForWeek(date, location)`. Return `NextResponse.json({ error }, { status: 400 })` on invalid input.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- zmanim-api-route`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/zmanim/route.ts tests/unit/zmanim-api-route.test.ts
git commit -m "feat: /api/zmanim accepts and validates location params"
```

---

### Task 5: `/api/zmanim/geocode` — Nominatim proxy

**Files:**
- Create: `src/app/api/zmanim/geocode/route.ts`
- Test: `tests/unit/zmanim-geocode-route.test.ts`

**Context:**
- `?q=<place>` → Nominatim search; `?lat=&lon=` → Nominatim reverse.
- Set header `User-Agent: FrumToronto/1.0 (https://frumtoronto.com)` (Nominatim policy).
- Search returns up to 6 `{ label, lat, lon, countryCode }`; reverse returns one `{ label, countryCode }`.
- Small in-memory `Map` cache keyed by the query string (bounded, e.g. clear when > 500 entries) to respect the 1 req/sec policy under bursts.
- Tests mock `global.fetch` with `vi.fn()` — no real network.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-geocode-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/zmanim/geocode/route';

function req(qs: string) {
  return new Request(`http://localhost/api/zmanim/geocode${qs}`);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/zmanim/geocode', () => {
  it('400 when neither q nor lat/lon provided', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('search maps Nominatim results to trimmed shape', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([
        { display_name: 'Wasaga Beach, Ontario, Canada', lat: '44.5209', lon: '-80.0177', address: { country_code: 'ca' } },
      ]), { status: 200 }),
    );
    const res = await GET(req('?q=wasaga'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      label: 'Wasaga Beach, Ontario, Canada',
      lat: 44.5209, lon: -80.0177, countryCode: 'ca',
    });
  });

  it('reverse returns a single labeled place', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        display_name: 'Jerusalem, Israel', address: { country_code: 'il' },
      }), { status: 200 }),
    );
    const res = await GET(req('?lat=31.7683&lon=35.2137'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toMatchObject({ label: 'Jerusalem, Israel', countryCode: 'il' });
  });

  it('502 when Nominatim errors', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const res = await GET(req('?q=wasaga'));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- zmanim-geocode-route`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Implement the route**

Create the route with a `q` branch (search) and a `lat/lon` branch (reverse), mapping Nominatim JSON to the trimmed shapes above, the `User-Agent` header, in-memory cache, and error handling (`502` on non-OK upstream, `400` on bad input). Parse `lat`/`lon` from Nominatim strings with `parseFloat`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- zmanim-geocode-route`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/zmanim/geocode/route.ts tests/unit/zmanim-geocode-route.test.ts
git commit -m "feat: /api/zmanim/geocode Nominatim proxy (search + reverse)"
```

---

### Task 6: Run the whole unit suite + typecheck

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: all pass, including the four new files.

- [ ] **Step 2: Typecheck the changed surface**

Run: `npx tsc --noEmit`
Expected: 0 errors. (Fix any `formatZmanTime` call sites the signature change touched.)

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -A && git commit -m "chore: typecheck fixups for zmanim location params" || echo "nothing to commit"
```

---

## Chunk 2: UI — LocationPicker + consumers

### Task 7: `LocationPicker` shared component

**Files:**
- Create: `src/components/zmanim/LocationPicker.tsx`

**Context / patterns:**
- Client component (`"use client"`). Mirror the debounce + `AbortController` approach in `src/components/search/UniversalSearch.tsx` (300ms, min 2 chars).
- `tz-lookup` runs client-side: `import tzlookup from 'tz-lookup';` then `tzlookup(lat, lon)`.
- Props:
  ```ts
  interface LocationPickerProps {
    value: ZmanimLocation;
    onChange: (loc: ZmanimLocation) => void;
    compact?: boolean; // widget: collapsed "Change location" link that expands
  }
  ```
- Behavior:
  - Shows `value.label` with a "Back to Toronto" reset (only when `value` !== Toronto) that calls `onChange(TORONTO_LOCATION)`.
  - Search box (debounced) → `GET /api/zmanim/geocode?q=` → dropdown of `results`. On select: `tzid = tzlookup(lat, lon)`, `isIsrael = isIsraelCountry(countryCode)`, call `onChange({ lat, lon, tzid, label, isIsrael })`.
  - "📍 Use my location": `navigator.geolocation.getCurrentPosition` → on success reverse-geocode `GET /api/zmanim/geocode?lat=&lon=` for the label + country → build location → `onChange`. On permission denied/unavailable: show inline message, keep `value`.
  - `compact` mode: render only the label + a "Change location" button; clicking expands the search UI.
- This component's parents own `localStorage` persistence (Task 8/9), so `LocationPicker` is stateless about storage — it just reports changes via `onChange`.

- [ ] **Step 1: Build the component** per the spec above (no unit test — repo tests logic, not React components; verified live in Task 10).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/zmanim/LocationPicker.tsx
git commit -m "feat: shared LocationPicker (search + GPS + reset)"
```

---

### Task 8: Wire the full picker into the Zmanim page

**Files:**
- Modify: `src/app/(public)/zmanim/ZmanimPageContent.tsx`

**Context:**
- Currently fetches `GET /api/zmanim?mode=week&date=${startDate.toISOString()}` and hardcodes Toronto copy at lines ~173, ~177, ~371.

- [ ] **Step 1: Add active-location state with localStorage hydration**

- Add `const [location, setLocation] = useState<ZmanimLocation>(TORONTO_LOCATION);`
- On mount (`useEffect`, empty deps): `const stored = parseStoredLocation(localStorage.getItem('ft_zmanim_location')); if (stored) setLocation(stored);`
- A `handleLocationChange(loc)` that: sets state, and persists — Toronto → `localStorage.removeItem('ft_zmanim_location')`, else `localStorage.setItem('ft_zmanim_location', serializeLocation(loc))`.

- [ ] **Step 2: Drive the week fetch off the location**

- Append `buildZmanimParams(location)` to the fetch URL and add `location` to the effect deps:
  `fetch(\`/api/zmanim?mode=week&date=\${startDate.toISOString()}&\${buildZmanimParams(location).toString()}\`)`

- [ ] **Step 3: Render `<LocationPicker value={location} onChange={handleLocationChange} />` in the header, and make copy dynamic**

- "Zmanim for Toronto" → `Zmanim for {location.label}`
- "Toronto, Ontario, Canada" → `{location.label}`
- "Times are calculated for Toronto, ON (43.66°N, 79.40°W)" → `Times are calculated for {location.label} ({location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°)`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(public)/zmanim/ZmanimPageContent.tsx"
git commit -m "feat: location picker on the zmanim page with persistence"
```

---

### Task 9: Wire the compact picker into the homepage widget

**Files:**
- Modify: `src/components/widgets/ZmanimWidget.tsx`

**Context:**
- Currently fetches `GET /api/zmanim` (today mode) on mount.

- [ ] **Step 1: Add the same location state + localStorage hydration** as Task 8 (default Toronto, hydrate on mount, `handleLocationChange` persists/clears).

- [ ] **Step 2: Include location params in the fetch**

- `fetch(\`/api/zmanim?\${buildZmanimParams(location).toString()}\`)`, add `location` to deps.

- [ ] **Step 3: Render `<LocationPicker value={location} onChange={handleLocationChange} compact />`** near the card header; show the active label. Keep the existing "View Full Zmanim" link.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/ZmanimWidget.tsx
git commit -m "feat: compact location picker on homepage zmanim widget"
```

---

### Task 10: End-to-end verification (live)

Use the **verify** skill / dev server — this exercises the browser→API→calc→response flow the unit tests can't.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (port 3000).

- [ ] **Step 2: Verify the zmanim page**
- Visit `/zmanim`. Default shows Toronto.
- Search "wasaga" → pick "Wasaga Beach" → times update, header reads "Zmanim for Wasaga Beach…", candle-lighting/havdalah present for the week.
- Search "jerusalem" → pick it → times shift to Israel clock; on a Yom Tov date, 1-day Yom Tov + 40-min candle lighting apply.
- "Back to Toronto" resets.
- Reload → last picked location persists (localStorage).

- [ ] **Step 3: Verify the homepage widget**
- Visit `/`. Widget shows active label (Toronto or persisted). "Change location" expands the search; picking a place updates the widget; persists across reload; shared with `/zmanim`.

- [ ] **Step 4: Verify "Use my location"** (browser will prompt) → detects a place name, updates times. Denying permission shows a graceful message and keeps the current location.

- [ ] **Step 5: Final full test run + typecheck**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: all pass, 0 type errors.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A && git commit -m "test: verify zmanim location picker end-to-end" || echo "nothing to commit"
```

---

## Notes / Deferred

- **`mode=shabbat`** stays Toronto-only (no consumer uses it). If a future feature needs Shabbat mode for arbitrary locations, thread `location` into that route branch and into `getUpcomingShabbat`'s own `toLocaleDateString`.
- **"Today" highlight across far timezones** uses the viewer's local day (documented limitation in the spec).
- **Nominatim usage policy**: acceptable for light community traffic; the server proxy + cache + debounce keep us within limits. If traffic grows, swap the geocoder behind the same `/api/zmanim/geocode` interface (Google/Mapbox) with no client changes.
- **Israel candle-lighting minutes**: set to 40 per the PM's approved choice; if a rav specifies otherwise per-city, this is the single place to adjust (`candleLightingMins` in `zmanim.ts`).
