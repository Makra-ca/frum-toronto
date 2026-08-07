# Eruv status page — design

**Date:** 2026-08-07
**Branch:** `feature/eruv-page` (worktree `../ft-eruv`)
**Status:** approved, not implemented

## Problem

`https://www.frumtoronto.com/eruv` returns 404. There is no `/eruv` route and
never has been. The 404 is reachable because `EruvWidget` renders
`<Link href="/eruv">Eruv Information</Link>` twice — at
`src/components/widgets/EruvWidget.tsx:90` (the error/no-data state) and `:159`
(the normal state). With `eruv_status` empty in production, the homepage today
shows "Unavailable" *and* a link to a 404.

Someone hit this from the other side already: `src/components/home/hero/LiveStrip.tsx:66`
carries the comment *"Plain text, not a link: there is no public /eruv page."*
The hero was worked around; the widget was not.

A second, quieter defect: `GET /api/community/eruv` returns the newest row by
`status_date` with **no recency guard**. If nobody updates the status for a
month, the homepage displays a month-old "UP" with full confidence. Someone may
carry on Shabbos on the strength of it.

## What exists

| Piece | Location | State |
|---|---|---|
| `eruv_status` table | `src/lib/db/schema.ts:688` | **0 rows in production** |
| Admin page | `/admin/community/eruv` | works — toggle, message, history |
| Admin API | `/api/admin/eruv` (GET, POST-upsert), `/[id]` (PATCH) | works |
| Public API | `/api/community/eruv` | works, but returns newest-regardless-of-age |
| Homepage widget | `src/components/widgets/EruvWidget.tsx` | works; links to a 404 |
| Public page | — | **does not exist** |

Schema:

```ts
eruvStatus = pgTable("eruv_status", {
  id, statusDate: date("status_date").notNull().unique(),
  isUp: boolean.notNull(), message: varchar(500),
  updatedBy: integer -> users.id, updatedAt: timestamp,
})
```

The legacy MSSQL server has no eruv table, so there is no historical data to
migrate.

## Decisions

Made by the owner during brainstorming, recorded so they are not re-litigated:

| Decision | Choice | Why |
|---|---|---|
| Page scope | **Status only** | No hotline number, boundaries, map or maintainer info — nothing static to write or keep true. |
| Staleness | **Tie the status to the Shabbos it applies to** | Rejected both a staleness cutoff and an age banner. Admin picks *which Shabbos*, and the public side looks the row up by that date, so a stale row simply doesn't match. Structural, not heuristic. |
| Yom Tov | **Out of scope — Saturdays only** | Considered and explicitly dropped. Yom Tov is detectable via hebcal's `CHAG` flag if it is ever wanted; see "Deliberately not built". |
| Migration | **None** | `status_date` keeps its type and unique constraint; only its meaning changes, from "the day I typed this" to "the Shabbos this applies to". The table is empty, so no existing row is reinterpreted. |

## Design

### 1. `src/lib/eruv/shabbos.ts` — pure

No database, no I/O, no `next/*` imports. This is the whole of the logic, which
is what makes it the thing worth testing.

```ts
/** "2026-08-08" — the Shabbos currently in effect. */
export function currentShabbos(now: Date): string

/** The next `count` Saturdays from `from`, each with its parsha label. */
export function listUpcomingShabbatot(from: Date, count: number): ShabbosOption[]

export type ShabbosOption = { date: string; label: string }  // "2026-08-08", "Eikev"
```

`currentShabbos` returns **today** if today is Saturday, otherwise the next
Saturday. It rolls over at midnight Toronto, so the page does not jump to next
week while people are still carrying on Shabbos afternoon.

This deliberately does **not** reuse `getUpcomingShabbat` from
`src/lib/zmanim.ts`. That function computes
`daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6` (`zmanim.ts:290`), so on
Saturday it jumps to *next* week's Shabbos. Correct for candle-lighting; wrong
here, where Saturday must still resolve to today.

"Today in Toronto" must come from `todayInLocation()` in
`src/lib/zmanim-day.ts`, not from server-local date components. Vercel runs
Node in UTC; reading `getDay()` off a bare `new Date()` puts a Toronto Friday
evening onto Saturday. This is the exact class of bug fixed in the
2026-07-26/27 session and it must not be reintroduced.

Parsha labels come from `getZmanimForDate(saturday).parsha`, already available.

### 2. `GET /api/community/eruv`

Returns:

```json
{ "shabbosDate": "2026-08-08", "status": { "isUp": true, "message": "...", "updatedAt": "..." } }
```

`status` is the `eruv_status` row whose `status_date` equals `shabbosDate`, or
**`null`** when no row exists. Because the lookup is by exact date, a status
entered for an earlier Shabbos can never surface as this week's. The current
`orderBy(desc(statusDate)).limit(1)` is replaced by an equality lookup.

This is a **response-shape change**. The only consumer is `EruvWidget`, which is
updated in the same change. The existing shape is already inconsistent — it
returns `{ status: null }` when empty and a bare row otherwise — so tightening
it is a net simplification.

### 3. Admin — `/admin/community/eruv`

The free-text date input becomes a select of the next ~10 Saturdays from
`listUpcomingShabbatot`, labelled `Sat, Aug 8 — Eikev`. The admin cannot set a
status for a Tuesday and cannot typo a date that will never be looked up.

Server-side validation is added to both write paths, because a constrained UI is
not a constraint:

- `POST /api/admin/eruv` — reject a `statusDate` that is not a Saturday (400).
- `PATCH /api/admin/eruv/[id]` — same check when `statusDate` is present. It
  currently accepts any date with no validation at all.

The existing `onConflictDoUpdate` on `status_date` already gives correct
re-entry behaviour: setting the status for the same Shabbos twice updates the
row rather than failing.

### 4. `/eruv` page

Server component at `src/app/(public)/eruv/page.tsx`, `force-dynamic` (matching
the other admin-managed public pages).

- Current Shabbos status: UP / DOWN / **not yet confirmed** when the row is `null`.
- Which Shabbos it is for, stated explicitly — "for Shabbos, Aug 8".
- The message, and when it was last updated.
- Recent history: the last several Shabbatot with their statuses.
- The existing "always verify before Shabbos" caution, carried over from the widget.

### 5. Widget fix

`EruvWidget.tsx` — both `<Link href="/eruv">` now resolve. The widget also
states which Shabbos the status is for, so "UP" is never undated, and renders
the "not yet confirmed" state when `status` is `null`.

## Testing

Unit (`tests/unit/eruv-shabbos.test.ts`), against `src/lib/eruv/shabbos.ts`:

- Sunday–Friday resolve to the upcoming Saturday.
- **Saturday resolves to itself, not next week** — the `getUpcomingShabbat`
  trap. This test must be verified to fail against `getUpcomingShabbat` before
  it is trusted.
- **Server-timezone independence**: resolution is identical with `process.env.TZ`
  set to UTC / Tokyo / Kolkata / Toronto / LA, following the existing sweep in
  `tests/unit/zmanim-calc.test.ts`. The unit project is pinned `TZ=UTC`, so
  without this the Toronto-evening bug is invisible.
- Friday 11:59 PM Toronto and Saturday 12:01 AM Toronto resolve to the same
  Shabbos.
- `listUpcomingShabbatot` returns only Saturdays, in order, with labels.

Integration: the public API returns `status: null` when the only row is for a
past Shabbos — the regression test for the staleness defect. Verify it fails
against the current `orderBy(desc).limit(1)` implementation before trusting it.

The page and widget are React components; the repo has jsdom configured
(`tests/unit-setup.ts`, per-file `// @vitest-environment jsdom`), so the
"not yet confirmed" state is worth a component test. Rendering is otherwise
verified in the browser.

## Deliberately not built

- **Yom Tov.** hebcal's `flags.CHAG` cleanly identifies Rosh Hashanah I/II, Yom
  Kippur, Sukkot I/II, Shmini Atzeret and Simchat Torah while correctly
  excluding Chol Hamoed — verified against 2026 during design. If it is ever
  wanted, that flag is the mechanism, and note that Sat 2026-09-26 is both
  Shabbos and Sukkot I, so any occasion list must dedupe by date.
- Hotline number, eruv boundaries, map, maintainer, halachic notes.
- Multiple eruvin. `eruv_status` has one row per date with no eruv identifier,
  so more than one eruv would need a schema change.
- Notifying subscribers when the eruv goes down. There is a `communityAlerts`
  preference and a working alerts path if this is wanted later.

## Risks

- **The rollover boundary is midnight Toronto, not tzeis.** Saturday 11 PM still
  shows that day's Shabbos. This errs toward displaying the occasion that just
  ended rather than jumping ahead, which is the safe direction, and it avoids
  coupling this module to the zmanim engine. Noted so it is a decision, not a
  surprise.
- **The page is only as good as the data.** With `eruv_status` empty, `/eruv`
  will read "not yet confirmed" until someone enters a status. That is honest
  and correct, but the owner should know the page ships empty.
- **`@hebcal/core` is ESM-only** in this repo — `npx tsx` on a standalone script
  fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Anything touching hebcal has to be
  exercised through vitest.
