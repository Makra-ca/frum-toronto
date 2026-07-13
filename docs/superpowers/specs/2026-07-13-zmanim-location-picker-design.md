# Zmanim Location Picker — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning

## Problem

Zmanim on FrumToronto are hardcoded to Toronto coordinates. A user based in
Toronto may travel elsewhere (e.g. Wasaga Beach for a Shabbos) and want to see
that location's zmanim — sunrise/sunset, and especially candle lighting and
havdalah — for that week. Today there is no way to do this.

On the old site users could pick a location. The requirement here is narrower
and cleaner: **not** a per-user profile setting and **not** tied to login —
just an *option* on the zmanim UI to view times for a different place.

## Goals

- Let anyone (logged in or not) view zmanim for any place on Earth, chosen by
  **place name** (never coordinates).
- Default remains **Toronto** — zero change for users who ignore the feature.
- Correct times for the chosen location, including timezone-correct display and
  correct Shabbos/Yom Tov candle lighting + havdalah.
- Remember the chosen location across reloads/navigation without a database or
  login.

## Non-Goals

- No per-user stored "home location" in the database.
- No login requirement.
- No admin-managed list of locations (search covers everything).

## Key Insight — Why This Is Small

Nothing about zmanim is hardcoded per-location. Zmanim are **astronomical
calculations** derived from (coordinates + date). The `@hebcal/core` library
already in the project (`src/lib/zmanim.ts`) computes them for any coordinates —
it is already location-agnostic. Today it is only ever handed one fixed set of
coordinates (Toronto). The feature is plumbing between three existing,
off-the-shelf pieces — **we build none of the hard parts**:

1. **Photon** (`photon.komoot.io`, OpenStreetMap-based) — global gazetteer +
   autocomplete: place name → coordinates + country. Called **client-side**
   (CORS-enabled, no key). Purpose-built for search-as-you-type. (We query it; we
   don't maintain it.)
2. **`@hebcal/core`** — coordinates + date → zmanim (the astronomy). Already in
   the project.
3. **`tz-lookup`** — coordinates → IANA timezone, so times display in the
   location's own clock.

**Why Photon, client-side (not Nominatim, server-side):** Nominatim's public
instance rate-limits/blocks cloud IPs, so a Vercel server proxy would funnel all
users through a few blockable IPs and fail under real traffic; its in-memory
cache wouldn't survive serverless cold starts anyway. Calling a geocoder from the
**browser** distributes requests across each user's own IP (naturally within fair
use), and Photon is CORS-enabled and built for autocomplete (Nominatim is a
lookup engine with weak typeahead). No server route, so no open-proxy surface.

## User Experience

### The control (shared component)

- **Active-location label** (e.g. "📍 Toronto, ON") with a **"Back to Toronto"**
  reset.
- **Search box**: user types a place name ("wasaga") → dropdown of matching
  named places → user picks one. No coordinates ever shown or typed.
- **"📍 Use my location"** button: one tap → browser geolocation → we reverse-
  lookup a display name → shows e.g. "Wasaga Beach, ON".

### Placement

- **`/zmanim` page**: full picker visible.
- **Homepage `ZmanimWidget`**: compact — shows the active place name + a small
  **"Change location"** link that expands the search box on click. Keeps the
  homepage clean; the full picker only appears on demand.

### Persistence

- The chosen location is stored in `localStorage` (key `ft_zmanim_location`,
  JSON: `{ lat, lon, tzid, label, isIsrael }`).
- Persists across reloads and navigation; shared between the widget and the full
  page.
- "Back to Toronto" clears the key and reverts to the Toronto default.
- On mount: read `localStorage`; if present, start there; otherwise Toronto.

## Data Flow

```
User types "wasaga"
      │  (debounced, client-side)
      ▼
GET https://photon.komoot.io/api/?q=wasaga&limit=6   ── direct from browser (CORS)
      │
      ▼  map GeoJSON → [{ label, lat, lon, countryCode }]
User picks "Wasaga Beach, ON"
      │
      ▼  tz-lookup(lat, lon) → "America/Toronto"   (client, offline)
      │  isIsrael = countryCode === "IL"
      ▼  save to localStorage
GET /api/zmanim?mode=week&date=...&lat=..&lon=..&tzid=..&label=..&il=0
      │
      ▼  @hebcal/core computes zmanim for those coords + Israel flag
Screen: "Zmanim for Wasaga Beach, ON" — full week, tz-correct
```

The **"Use my location"** path skips the search box: `navigator.geolocation`
gives lat/lon directly → one Photon **reverse** call
(`https://photon.komoot.io/reverse?lat=..&lon=..`) for the label + country → same
tz-lookup and same `/api/zmanim` call.

## Components & Changes

### 1. `src/lib/zmanim.ts` — parameterize by location

Currently every function uses the module-level `torontoLocation` constant.

- Add type `ZmanimLocation = { lat: number; lon: number; tzid: string; label: string; isIsrael: boolean }`.
- Export `TORONTO_LOCATION: ZmanimLocation` as the default.
- `getZmanimForDate(date, location = TORONTO_LOCATION)`,
  `getZmanimForWeek(startDate, location = TORONTO_LOCATION)`,
  `getUpcomingShabbat(location = TORONTO_LOCATION)` — build
  `new Location(location.lat, location.lon, location.isIsrael, location.tzid, location.label, ...)`
  from the argument, and pass `il: location.isIsrael` to `HebrewCalendar.calendar(...)`.
- **Bug fix — timezone-aware formatting:** `formatZmanTime` currently hardcodes
  `America/Toronto` (`zmanim.ts:184`), as does the English date string
  (`zmanim.ts:142`). Both must take the target `tzid` so a Miami sunset formats
  in Eastern time, not always Toronto. `formatZmanTime(date, tzid)`.
- **Israel rules (decided):** pass `il: location.isIsrael` to
  `HebrewCalendar.calendar(...)` — this gives correct **1-day Yom Tov** for
  Israeli locations. **Candle lighting stays hebcal's 18-minute default
  everywhere, including Israel.** The 40-minute value is a *Jerusalem-specific*
  custom and is wrong for most Israeli cities (Haifa, Tel Aviv, Bet Shemesh, etc.
  use other values), so we do **not** apply a blanket 40. 18 min is the base
  halacha; communities add their own chumra. (Revisit per-city only if a rav
  specifies.)

### 2. `src/app/api/zmanim/route.ts` — accept location params

- New optional query params: `lat`, `lon`, `tzid`, `label`, `il` (`"1"`/`"0"`).
- If none provided → Toronto default (fully backward compatible; existing
  callers unaffected).
- Validate: `lat`/`lon` finite and in range (lat -90..90, lon -180..180),
  `tzid` non-empty string; on invalid input return 400.
- Thread the resolved `tzid` into every `formatZmanTime(...)` call for the
  `today` and `week` branches (the two branches this feature exercises).
- **`mode=shabbat` is intentionally left on Toronto for now.** That branch
  (`route.ts:49-62`) uses `getUpcomingShabbat()` and its own untimezoned
  `toLocaleDateString`; no consumer in this feature calls it (widget uses
  today/default, page uses week). `getUpcomingShabbat` still gains a `location`
  param per §1 for consistency, but wiring the `shabbat` route branch to the
  active location is out of scope here.
- **Cache-key stability:** round `lat`/`lon` to ~4 decimal places before
  building the `/api/zmanim` URL. Geocoded coordinates carry long decimal tails;
  rounding keeps `revalidate = 3600` cache keys stable without changing
  displayed times (4 decimals ≈ 11 m precision, far finer than zmanim need).
- Keep `revalidate = 3600`; the response naturally varies by query params.

### 3. `src/lib/geocode.ts` — NEW (client-side Photon helper)

No server route. A small browser-callable module wrapping Photon:

- `searchPlaces(q, signal?)` → `GET https://photon.komoot.io/api/?q=<q>&limit=6&lang=en`
  → map the GeoJSON `FeatureCollection` to `GeocodeResult[]`
  (`{ label, lat, lon, countryCode }`). Photon features give
  `geometry.coordinates: [lon, lat]` and `properties: { name, city, state,
  country, countrycode }`; build `label` from the available name parts.
- `reverseGeocode(lat, lon)` → `GET https://photon.komoot.io/reverse?lat=..&lon=..&lang=en`
  → single `{ label, countryCode }` (used by "Use my location").
- Pure enough to unit-test by mocking `fetch` (no DOM needed).
- On non-OK response or fetch error, throw/return an empty result the caller can
  surface as "couldn't find that place."

### 4. `src/components/zmanim/LocationPicker.tsx` — NEW (shared)

- Props: current `ZmanimLocation`, `onChange(location)`, and a `compact` flag
  (widget vs full page).
- Debounced search (mirror the existing `UniversalSearch` pattern — 300ms +
  `AbortController`) calling `searchPlaces()` from `src/lib/geocode.ts`.
- On result select: `tz-lookup` for tzid, `isIsrael = countryCode === "IL"`,
  build the `ZmanimLocation`, call `onChange` (parent persists to `localStorage`).
- "📍 Use my location": `navigator.geolocation.getCurrentPosition` →
  `reverseGeocode()` for the label + country → same path. Handle
  permission-denied / unavailable gracefully (show a message, keep current
  location).
- "Back to Toronto" reset calls `onChange(TORONTO_LOCATION)`.

### 5. Consumers

- **`ZmanimPageContent.tsx`**: render `LocationPicker` (full); drive the
  existing week fetch off the active location's params; make the hardcoded
  strings dynamic — "Zmanim for Toronto" (`:173`), "Toronto, Ontario, Canada"
  (`:177`), and "Times are calculated for Toronto, ON (43.66°N, 79.40°W)"
  (`:371`) reflect the active place.
- **`ZmanimWidget.tsx`**: render `LocationPicker` (compact); include the active
  location's params in its `/api/zmanim` fetch; show the active label.

### 6. Dependency

- Add **`tz-lookup`** (coordinates → IANA tzid, offline, tiny, serverless-safe).
- No new environment variables or secrets.

## Error Handling

- **Geocoder down / no results**: show "Couldn't find that place, try again";
  keep the current location active.
- **GPS denied/unavailable**: show a short message; keep current location.
- **Invalid `/api/zmanim` params**: 400; client falls back to Toronto and clears
  the bad `localStorage` entry.
- **Photon rate/fair-use**: naturally distributed (per-user browser IP) + 300ms
  client debounce + min-2-chars keep request volume low. If Photon's public
  instance is ever unreliable, the `src/lib/geocode.ts` interface is the single
  swap point (self-hosted Photon, or a keyed provider like Geoapify/LocationIQ)
  with no consumer changes.

## Testing

- **`zmanim.ts` unit**: same date, different `ZmanimLocation` inputs (Toronto,
  Miami, Jerusalem) produce distinct, plausible times; times format in the
  correct timezone; an Israeli location computes without error (exact Yom Tov /
  candle-time behavior verified live — brittle to assert).
- **`formatZmanTime`**: a fixed instant renders differently for two tzids with
  different offsets (regression test for the hardcoded-timezone bug).
- **`/api/zmanim`**: no params → Toronto (unchanged); valid params → that
  location; invalid lat/lon → 400.
- **`src/lib/geocode.ts`**: mock `fetch`; a Photon FeatureCollection maps to
  `{ label, lat, lon, countryCode }`; reverse maps to `{ label, countryCode }`;
  non-OK response surfaces an error/empty result.
- **`LocationPicker`**: verified live (repo has no React component test harness).

## Known Limitations

- **"Today" across far timezones:** week iteration and the "is today" card
  highlight use the *viewer's* local day arithmetic on JS `Date`, not the chosen
  location's clock. For a far-away location (e.g. Israel) the highlighted "today"
  reflects the viewer's date, which can differ by a day near midnight. Accepted
  for this feature; documented here so it isn't later mistaken for a bug.

## Rollout

- Backward compatible: default path is unchanged Toronto behavior; only additive
  params and new client-side files.
- No DB migration. No new server route. No new env vars/secrets.
