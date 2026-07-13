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

1. **Nominatim / OpenStreetMap** — global gazetteer: place name → coordinates +
   country. (We query it; we don't maintain it.)
2. **`@hebcal/core`** — coordinates + date → zmanim (the astronomy). Already in
   the project.
3. **`tz-lookup`** — coordinates → IANA timezone, so times display in the
   location's own clock.

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
      │  (debounced)
      ▼
GET /api/zmanim/geocode?q=wasaga   ── server proxy to Nominatim (search)
      │
      ▼  returns [{ label, lat, lon, countryCode }]
User picks "Wasaga Beach, ON"
      │
      ▼  tz-lookup(lat, lon) → "America/Toronto"   (client, offline)
      │  isIsrael = countryCode === "il"
      ▼  save to localStorage
GET /api/zmanim?mode=week&date=...&lat=..&lon=..&tzid=..&label=..&il=0
      │
      ▼  @hebcal/core computes zmanim for those coords + Israel flag
Screen: "Zmanim for Wasaga Beach, ON" — full week, tz-correct
```

The **"Use my location"** path skips the search box: `navigator.geolocation`
gives lat/lon directly → one reverse-geocode call for the label → same tz-lookup
and same `/api/zmanim` call.

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
- **Israel candle-lighting nuance:** the `il` flag drives 1-day vs 2-day Yom Tov.
  The 40-minute Jerusalem candle-lighting custom must be verified against the
  `@hebcal/core` API during implementation — set `candleLightingMins`
  appropriately for Israeli locations (default diaspora stays 18). This is an
  implementation detail to confirm, not assume.

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

### 3. `src/app/api/zmanim/geocode/route.ts` — NEW

- `GET ?q=<place>` → forward to Nominatim search; set a proper `User-Agent`
  (Nominatim usage policy); return a trimmed list
  `[{ label, lat, lon, countryCode }]` (cap ~6 results).
- `GET ?lat=..&lon=..` → Nominatim reverse geocode → single `{ label, countryCode }`
  (used by "Use my location").
- Small in-memory cache keyed by query to stay within Nominatim's 1 req/sec/IP
  policy under light bursts.
- On upstream failure, return a graceful error the client can surface.

### 4. `src/components/zmanim/LocationPicker.tsx` — NEW (shared)

- Props: current `ZmanimLocation`, `onChange(location)`, and a `compact` flag
  (widget vs full page).
- Debounced search (mirror the existing `UniversalSearch` pattern — 300ms +
  `AbortController`) hitting `/api/zmanim/geocode`.
- On result select: `tz-lookup` for tzid, compute `isIsrael`, persist to
  `localStorage`, call `onChange`.
- "📍 Use my location": `navigator.geolocation.getCurrentPosition` → reverse
  geocode for label → same path. Handle permission-denied / unavailable
  gracefully (show a message, keep current location).
- "Back to Toronto" reset clears `localStorage`.

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
- **Nominatim rate limit**: mitigated by server-side proxy + in-memory cache +
  client debounce.

## Testing

- **`zmanim.ts` unit**: same date, different `ZmanimLocation` inputs (Toronto,
  Wasaga Beach, Miami, Jerusalem) produce distinct, plausible times; times
  format in the correct timezone; Jerusalem applies Israel rules (1-day Yom Tov,
  Israel candle lighting) on a Yom Tov date.
- **`formatZmanTime`**: a fixed instant renders differently for Toronto vs Miami
  tzid (regression test for the hardcoded-timezone bug).
- **`/api/zmanim`**: no params → Toronto (unchanged); valid params → that
  location; invalid lat/lon → 400.
- **geocode route**: known place returns results with coordinates + country;
  reverse geocode returns a label.
- **`LocationPicker`**: search-select updates state + persists; "Back to Toronto"
  resets; GPS-denied path keeps current location.

## Known Limitations

- **"Today" across far timezones:** week iteration and the "is today" card
  highlight use the *viewer's* local day arithmetic on JS `Date`, not the chosen
  location's clock. For a far-away location (e.g. Israel) the highlighted "today"
  reflects the viewer's date, which can differ by a day near midnight. Accepted
  for this feature; documented here so it isn't later mistaken for a bug.

## Rollout

- Backward compatible: default path is unchanged Toronto behavior; only additive
  params and a new route/component.
- No DB migration.
