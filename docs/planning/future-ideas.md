# Future Ideas — parked

Ideas worth building, not scheduled. Each entry records **why it is cheap or valuable now**, with
measured evidence, so a future session does not have to re-derive it.

Newest first.

---

## Shuls / businesses near me — geocoding from the legacy postal-code table

**Parked:** 2026-08-07 · **Raised by:** Daniel, during the shul-affiliation review
**Status:** Idea. Not designed, not scheduled.

### The idea

Show shuls and businesses on a map, sort them by distance, and answer "what's near me" — nearest
minyan, kosher restaurants within walking distance, shuls in this neighbourhood.

### Why it is cheap right now

The Postgres schema was **already built for this and has never had data**:

| | |
|---|---|
| `shuls.latitude` / `longitude` (`decimal`) | **0 of 14** populated |
| `businesses.latitude` / `longitude` (`decimal`) | **0 of 1,635** populated |

And the legacy database contains a complete Canadian geocoding table nobody has opened:

```
FrumToronto.dbo.PostalCodes  —  765,354 rows
                                765,354 with real, non-zero coordinates
                                1,586 distinct FSAs, all CountryCode = 'Ca'
```

Measured join rates (2026-08-07, read-only):

- **125 of 127** shul listings that have a postal code geocode by a plain join (98.4%)
- **1,286 of 1,511** directory listings overall (85.1%)
- Verified samples: `Agudath Israel of Toronto (M5M 2Y7) → 43.7328, -79.4186` ·
  `Abir Yaakob Congregation (L4J 8K3) → 43.8171, -79.4309`

So this is **one hash join at import time**. No Google Maps key, no API cost, no rate limit, no
external dependency, no per-request latency.

### The trap that hid it

`DirectoryListings.Latitude` / `Longitude` **look** like the source and are worthless: 1,065 rows
non-NULL across the table, and **every one of them is `0`**. The real coordinates were always in a
separate table. This is the third instance in one session of a column name being read as evidence
of data — see the note at the bottom of this file.

### What it unlocks

- Map pins on shul and business detail pages
- "Nearest minyan" — genuinely useful, and pairs with the existing davening-times work
- Distance sorting in the business directory
- A real meaning for neighbourhood filtering (see the related idea below)

### What it needs

1. A one-off geocode pass at import: join `PostalCodes` on a normalised postal code, write
   `latitude`/`longitude`. **Do not import the 765k-row table into Neon** — use it once, at import
   time, and discard it.
2. A fallback for the ~15% with no postal code or no match (hand-fill, or geocode the address once
   via an external service).
3. A map component. Nothing exists today — no Leaflet, no Mapbox, no Google Maps in the repo.
4. A decision on distance: PostGIS is not enabled on this Neon database; the Haversine formula in
   SQL is fine at these row counts (≈1,650 rows total).

### Caveats

- Postal-code centroids are **approximate** — accurate to the delivery area, not the building. Fine
  for "near me" and map pins; not fine for turn-by-turn directions.
- ~10 of the 166 shul listings are outside the GTA (London ×2, Hamilton, Niagara Falls, Ottawa
  area). Distance sorting needs to handle that gracefully.
- Coordinates are personal-ish for a home-based minyan. Worth checking before publishing a pin for
  every listing.

### Related, same source

- **Neighbourhood tags.** `DirectoryListings.LocationID` → `Locations` (20 rows) is populated on
  **164 of 166** shuls, using the vocabulary the community actually says — *Bathurst & Wilson* (27),
  *Bathurst & Lawrence* (24), *Bathurst & Clark* (21), *Down Town* (18). Postgres
  `shuls.neighborhood` is set on **1 of 14**, and the 8 hand-seeded `shul_neighborhoods` names
  (Thornhill, Forest Hill, North York…) **do not match** the legacy vocabulary. CLAUDE.md lists
  "tag shuls with neighbourhoods" as an outstanding manual owner task — this would do it
  automatically, and better.

---

## A note for whoever reads this next

Three separate times in the session that produced this file, a design was written on the assumption
that a column contained data because the column *existed*. Each time it was wrong, and twice the
data that was actually needed sat in a table nobody had opened.

**Before citing any legacy column in a spec, run:**

```sql
SELECT COUNT(*) FROM <table>
WHERE <col> IS NOT NULL AND LTRIM(RTRIM(CAST(<col> AS nvarchar(max)))) <> '';
-- and for numeric columns, also: AND <col> <> 0
```

A full populated-count inventory of `DirectoryListings`, `MemberList`, `Locations` and
`DaveningSchedule` was produced on 2026-08-07 and is worth regenerating rather than trusting from
memory.
