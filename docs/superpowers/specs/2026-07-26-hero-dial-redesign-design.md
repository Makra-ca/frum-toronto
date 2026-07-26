# Homepage Hero Redesign — "The Dial"

**Date:** 2026-07-26
**Status:** Approved for planning
**Scope:** Homepage hero only (`src/components/home/HeroSection.tsx` and its direct dependencies), plus the site-wide font change required to render Hebrew correctly.

---

## Problem

`src/components/home/HeroSection.tsx` (527 lines) reads as machine-generated. Concretely:

1. **Nine navigation nodes orbit continuously at 3°/sec** (`DEG_PER_MS = 3/1000`) — a full lap every two minutes. Clickable targets that never hold still.
2. **Nine unrelated gradients** (`from-blue-500`, `from-purple-500`, `from-emerald-500`, `from-pink-500`, `from-amber-500`, `from-rose-500`, `from-slate-500`, …) — no colour hierarchy, so nothing is emphasised.
3. **Thirty hand-written star particles** (`starParticles`, lines 35–66) implying a space theme unrelated to the product.
4. **Six simultaneous decorative effects**: shimmer sweep per node, two pulsing glow rings, a hub glow blur, dashed connector spokes, and randomly-firing "data packet" circles (`activeConnections`, re-randomised every 2000 ms).
5. **Labels are unreadable** — 8px text inside a 56px tile, and they *shrink further* when not hovered.
6. **Hover resizes the node to 125%**, displacing its neighbours and injecting a description that reflows the card.
7. **A redundant eyebrow** — `TORONTO JEWISH COMMUNITY` above an `<h1>` reading "Welcome to FrumToronto", above a logo already saying FrumToronto.
8. **Four equal-weight CTAs**, three of which duplicate destinations present in the nav bar, in the orbiting nodes, *and* in `QuickLinks` immediately below the fold.

Two problems found while investigating, both verified:

- **Hebrew text on the site is rendered by an arbitrary OS font.** Two independent causes, both verified: `src/app/layout.tsx` requests `subsets: ["latin"]` only, so no Hebrew glyphs are ever loaded; and Urbanist ships no Hebrew subset in the first place (confirmed against Google's served CSS — `latin` and `latin-ext` only). Every Hebrew string on the site — Hebrew dates on `/community/calendar` and its detail page, `hebrewName` / `motherHebrewName` on tehillim, `niftarNameHebrew` on shiva notices — falls back to an arbitrary OS font (Segoe UI/David on Windows, Arial Hebrew on macOS, Noto on Android), mismatched in weight and x-height against Urbanist.
- **The most-wanted recurring information is at the bottom of the homepage.** `src/app/page.tsx` lines 62–67 place `ZmanimWidget` and `EruvWidget` below the hero, banner ads, `QuickLinks`, `CommunityCornerTabs`, `FeaturedBusinesses` *and* `UpcomingEvents`.

### Non-goals

- No change to `QuickLinks`, `CommunityCornerTabs`, `FeaturedBusinesses`, `UpcomingEvents`, or the homepage ad components.
- `ZmanimWidget` and `EruvWidget` stay where they are. The live strip partly duplicates them; removing or relocating them is a separate decision for the owner.
- No change to `/zmanim`, the zmanim location picker, or `src/lib/zmanim.ts`'s calculations.
- No new halachic opinions or times beyond those `getZmanimForDate()` already returns.

---

## Design decisions (confirmed with owner, 2026-07-26)

| Decision | Choice | Notes |
|---|---|---|
| Right-hand treatment | **The Dial** | Tick-marked instrument ring; rejected alternatives were a Today panel, a quiet 3×3 grid, a centred layout with nothing on the right, a static constellation, and an abstract neighbourhood map. |
| Typeface | **Frank Ruhl Libre (display) + Assistant (UI/body)** | Explicitly overrides the global `CLAUDE.md` preference for Urbanist. Both cover Hebrew. |
| Background | **React Bits `LightRays`** | Adds `ogl`. Gated — see §7. |
| Live strip above the fold | **Yes** | Candle lighting · eruv · Hebrew date. |
| Location for displayed times | **Follows the visitor's saved zmanim location** | Owner chose this over always-Toronto, accepting the tradeoff in §5. |

### Rejected, with reasons

- **Keeping the orbit as-is but slower only** — does not address the nine gradients, unreadable labels, or hover resize.
- **Aurora / Waves / Grainient backgrounds** — Aurora and Grainient read as generic SaaS; `Waves`' line field competes visually with the dial's tick marks.
- **Three.js-based backgrounds** (`Silk`, `Beams`, `Ballpit`) — require `three` + `@react-three/fiber` + `drei`, ~600 KB gzipped.
- **`SplitText` / GSAP headline animation** — GSAP is a larger install than the benefit of a one-shot entrance justifies.
- **Live activity ticker** — reads as a social feed and looks dead without constant fresh content.
- **Photo mosaic of businesses** — insufficient quality photography today; a half-populated grid looks worse than none.

---

## 1. Hero composition

Top to bottom:

1. **Live strip** — full-width, one line: the primary zman (see *Primary zman* below), eruv status, Hebrew date (parsha + date in Hebrew). Visually distinct from the hero body by a faint accent-tinted background and a bottom hairline.
2. **Two-column body** (single column below `md`):
   - **Left:** `<h1>`, supporting sentence, search field, "Popular:" chips, one stat line.
   - **Right:** the dial.
3. No CTA button row. No scroll indicator. No eyebrow above the `<h1>`.

The stat line reads `142 businesses · 38 shuls · 12 events this week`. Those numbers are **live** (§3) — the illustrative values here are placeholders. "Static" throughout this spec means *unanimated*: no count-up, rendered at its final value.

### Primary zman — the value shown in the strip and the hub

`getZmanimForDate()` returns `candleLighting` only on Friday and Yom Tov eve, and `havdalah` only when the day ends Shabbos/Yom Tov. On a Tuesday both are `null`. A single resolver, `resolvePrimaryZman()` in `src/lib/hero/primaryZman.ts`, is the only place this is decided, and both the strip and the hub consume its output:

| Condition | Shown | Label |
|---|---|---|
| `candleLighting` is non-null | that time | `Candle lighting` |
| else `havdalah` is non-null | that time | `Havdalah` |
| else | upcoming Shabbos candle lighting via the existing `getUpcomingShabbat()` | `Candle lighting Fri` |
| all three unavailable | the FrumToronto wordmark in the hub; the strip omits the zman segment entirely and shows only eruv + Hebrew date | — |

The final row exists so no code path can render `formatZmanTime(null)` → `"--:--"`. The resolver returns `{ time: Date; label: string } | null`; a `null` return is what triggers the wordmark fallback. This is the only invented rule in the spec and it is confined to one function.

### The dial

- A hairline ring with **72 tick marks**, one per 20 minutes of the day (72 × 20 min = 1440 min). Every sixth tick (each two hours) is longer.
- Ticks for elapsed time today are rendered at low opacity; upcoming ticks at higher opacity.
- **Elapsed ticks are computed client-side only.** On the server, and on the first client render, every tick renders as *upcoming* — so server and client markup agree and there is no hydration mismatch. After mount, `minutesElapsedInDay(new Date(), tzid)` runs and the ring updates, then re-runs **every 60 seconds** so a 20-minute boundary is never more than a minute stale. The interval is cleared on unmount.
- **Eight navigation discs** ride the ring, evenly spaced, orbiting at **0.5°/sec** (one lap ≈ 12 minutes; the implementation constant is the single source of truth and may be tuned between 0.4 and 0.6°/sec without other changes).
- Each disc: 44px, circular, 1px accent border, transparent-dark fill, one monochrome outline icon, and a label **outside** the disc at 9.5px uppercase. Disc size and label size never change.
- Discs stay upright while orbiting — the ring rotates and each disc counter-rotates by the same amount.
- **Hub** (centre): the primary zman and its label. On hovering a disc, the hub instead shows that destination's name and its secondary line, reverting on mouse-out. This replaces the current hover-resize behaviour, so nothing moves on hover.

The eight destinations, in ring order: Shuls, Zmanim, Events, Directory, Shiurim, Classifieds, Simchas, Ask the Rabbi. (Nine → eight; **Shiva is dropped from the dial** — it remains in the nav and on `/shiva`. Eight divides the ring evenly and keeps the sombre item out of a decorative rotation.)

**Only three destinations have a live count.** `heroNodes.ts` gives every node a required `description` string and an optional `countKey`:

| Destination | `countKey` | Hub secondary line |
|---|---|---|
| Directory | `businesses` | `142 kosher businesses` (live) |
| Shuls | `shuls` | `38 shuls in Toronto` (live) |
| Events | `events` | `12 this week` (live) |
| Zmanim | — | `Today's times` |
| Shiurim | — | `Torah classes near you` |
| Classifieds | — | `Buy, sell & trade` |
| Simchas | — | `Share your good news` |
| Ask the Rabbi | — | `Answered questions` |

Nodes without a `countKey` render `description` verbatim. No additional count queries are introduced.

---

## 2. File structure

`HeroSection.tsx` currently performs six jobs in one file: background decoration, orbit animation, stats fetching + count-up animation, search, CTA rendering, and scroll control. It splits into units with single responsibilities:

| File | S/C | Responsibility | Depends on |
|---|---|---|---|
| `src/lib/hero/dial.ts` | — | **Pure geometry and time maths.** No React, no DOM. | nothing |
| `src/lib/hero/primaryZman.ts` | — | **Pure.** `resolvePrimaryZman()` — the candle-lighting/havdalah/upcoming fallback chain. | `lib/zmanim` |
| `src/components/home/hero/heroNodes.ts` | — | The eight destinations: `id`, `label`, `href`, `icon`, `description`, optional `countKey`. | `lucide-react` |
| `src/components/home/hero/HeroSection.tsx` | **Server** | Layout shell. Receives all server data as props, renders `HeroLiveData` and `HeroSearch`. Holds no state. | the units below |
| `src/components/home/hero/HeroLiveData.tsx` | **Client** | **Owns the resolved location** and everything derived from it. Calls `useStoredZmanimLocation()`, performs the non-Toronto fetch, and renders `LiveStrip` + `CommunityDial` as children, passing each the resolved values. | `useStoredZmanimLocation`, `lib/hero/primaryZman` |
| `src/components/home/hero/LiveStrip.tsx` | **Client** | Presentational. Renders zman + eruv + Hebrew date from props. No fetching, no location logic. | — |
| `src/components/home/hero/CommunityDial.tsx` | **Client** | RAF orbit loop, tick rendering, hub state, hover/focus pause. Receives zman + counts + `tzid` as props. | `lib/hero/dial` |
| `src/components/home/hero/HeroSearch.tsx` | **Client** | Wraps `UniversalSearch`, renders popular chips. Owns the `useRouter` call that currently lives in `HeroSection`. | `UniversalSearch` |
| `src/components/home/hero/LightRays.tsx` | **Client** | React Bits component, vendored. Gated renderer. | `ogl` |

`HeroLiveData` exists specifically to resolve the ownership question: the strip and the dial both display location-dependent times, and siblings cannot pass props to each other. It is the single client boundary that owns the location, and it is what makes §5 coherent. Its props are the server-rendered Toronto values; its state is the resolved location plus whatever times that location produced.

`HeroSection.tsx` becomes a **server component** — the `useRouter` call that forces `"use client"` today moves into `HeroSearch`.

### `src/lib/hero/primaryZman.ts` interface

```ts
export interface PrimaryZman { time: Date; label: string }

/** Applies the fallback chain in §1. Returns null when no zman is available. */
export function resolvePrimaryZman(
  zmanim: Pick<ZmanimResponse, "candleLighting" | "havdalah">,
  location: ZmanimLocation,
  now: Date,
): PrimaryZman | null
```

`src/components/home/HeroSection.tsx` is deleted; `src/app/page.tsx` imports from the new path.

### `src/lib/hero/dial.ts` interface

```ts
export interface TickMark { x1: number; y1: number; x2: number; y2: number; elapsed: boolean }
export interface NodePosition { x: number; y: number }   // percentages, 0–100

/** 72 ticks on a circle of `radius` within a `size`×`size` viewBox.
 *  `minutesElapsed` (0–1440) marks which ticks are in the past. */
export function getTickMarks(size: number, radius: number, minutesElapsed: number): TickMark[]

/** Evenly-spaced position for node `index` of `count`, offset by `angleDeg`. */
export function getNodePosition(index: number, count: number, angleDeg: number, radiusPct: number): NodePosition

/** Minutes since local midnight in `tzid`, clamped to 0–1440. */
export function minutesElapsedInDay(now: Date, tzid: string): number
```

Every value the dial needs comes from these three functions. `CommunityDial` holds no geometry maths of its own.

---

## 3. Data flow

`src/app/page.tsx` is already a server component. It becomes **`async`**, and it must declare `export const dynamic = "force-dynamic"`.

**The `force-dynamic` declaration is required, not optional.** `page.tsx` currently uses no dynamic APIs, so Next.js statically prerenders it at build time. Adding `getZmanimForDate(new Date())` and the count queries without it would bake build-time candle lighting, eruv status and counts into the HTML permanently. The two routes whose work is moving into the page — `/api/stats/route.ts` and `/api/community/eruv/route.ts` — both carry `dynamic = "force-dynamic"` today; moving their queries into the page without it silently drops that guarantee. This also matches the project `CLAUDE.md` rule for admin-managed content.

**Server, on render:**
1. `getZmanimForDate(new Date(), TORONTO_LOCATION)` → candle lighting, havdalah, Hebrew date, parsha, `isShabbat`.
2. `resolvePrimaryZman(...)` on that result → the strip's and hub's initial value.
3. Drizzle query for the **latest** `eruvStatus` row: `orderBy(desc(eruvStatus.statusDate)).limit(1)`.
4. Drizzle count queries for approved+active `businesses`, active `shuls`, and future approved+active `events` within 7 days. These are the only three counts (§1).

**Eruv semantics — deliberately identical to `/api/community/eruv`.** That route returns the latest row by `statusDate`, *not* today's row, and applies **no staleness cutoff**. Admins post a row per update rather than per day, so a `statusDate = today` query would usually return nothing and the strip would show no eruv while `EruvWidget` further down the same page showed "Up". Matching the existing query exactly is what prevents the two disagreeing. **When there is no row at all, the strip omits the eruv segment** — it never renders "Unknown" or a default state.

These are passed to `<HeroSection>` as props. This removes **one** client-side fetch waterfall — the hero's own `fetch("/api/stats")` (current lines 224–229). `EruvWidget` keeps its own fetch, since it stays on the page unchanged.

**Client, after hydration:**
`HeroLiveData` calls the existing `useStoredZmanimLocation()` hook. If it returns Toronto (the default, and the case with no `localStorage` entry), nothing further happens — no request, no re-render of times. If it returns a non-Toronto location, it fetches `/api/zmanim?lat=…&lon=…&tzid=…&label=…&il=…` (the route already accepts and validates these), re-runs `resolvePrimaryZman()` on the result, and passes the new values down to both children in one update.

`@hebcal/core` therefore stays out of the client bundle. `resolvePrimaryZman` is pure: it takes `candleLighting`, `havdalah` and `upcomingCandleLighting` as `Date | null` inputs and picks one. The server supplies the third from `getUpcomingShabbat(TORONTO_LOCATION)`.

**One additive API change is required.** For a non-Toronto location the client needs that third value too, and the default (`mode=today`) response of `/api/zmanim` does not currently include it. The response gains one field:

```ts
upcomingCandleLighting: string | null   // formatted in the requested location's tzid
```

computed by `getUpcomingShabbat(location)` — a function that **already accepts a location parameter**, so no new halachic logic is introduced and no existing behaviour changes. This is purely additive; existing consumers ignore the new field. The route's separate `mode=shabbat` branch remains hardcoded to Toronto and is **not** touched (it has no callers, per the 2026-07-13 session notes).

Without this, non-Toronto visitors would lose the zman segment on every non-Friday — a silent regression, which is why it is specified rather than deferred.

Because `HeroLiveData` owns the location, the strip and the hub cannot disagree: there is one resolved value and both receive it as props.

---

## 4. Typography

`src/app/layout.tsx`:

```ts
import { Frank_Ruhl_Libre, Assistant } from "next/font/google";

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank",       // NOT --font-display, see below
  subsets: ["latin", "hebrew"],
});
const assistant = Assistant({
  variable: "--font-assistant",   // NOT --font-sans
  subsets: ["latin", "hebrew"],
});
```

Both variables go on `<body>`. The `Urbanist` import is removed.

`src/app/globals.css`, inside the existing `@theme inline` block:

```css
--font-sans: var(--font-assistant);   /* was var(--font-urbanist) */
--font-display: var(--font-frank);
```

**The `next/font` variable names must differ from the Tailwind theme token names.** Writing `--font-display: var(--font-display)` is self-referential and resolves to nothing, so the `<h1>` would silently fall back to the sans stack with no error. The existing Urbanist setup works precisely because the two names differ (`--font-sans: var(--font-urbanist)`); the new pairs follow the same rule.

**No `weight` array is passed.** Both families are variable fonts on Google Fonts; specifying discrete weights would load fixed instances and give up the variable axis. Omitting `weight` keeps the full range available.

`--font-display` becomes available as Tailwind's `font-display` utility and is applied to the hero `<h1>`, the hub time, the "Today"-style headings, and the logo wordmark. Everything else inherits Assistant via `font-sans`.

**Site-wide consequence, intended:** all Hebrew text across the site now renders in Assistant (or Frank Ruhl Libre where `font-display` applies) instead of an OS fallback. Body copy shifts from Urbanist to Assistant everywhere. Adding the Hebrew subset costs roughly 8–12 KB per family, self-hosted and subset at build time by `next/font`.

---

## 5. Location tradeoff (accepted by owner)

Following the saved location means the hub time and the strip cannot be purely server-rendered for non-Toronto visitors. Mitigations, all required:

1. **Toronto is the server-rendered default**, so the common case has no swap at all.
2. When a saved non-Toronto location exists, the strip renders the **location name beside the times** (e.g. "Jerusalem · Candle lighting 7:12 PM"), so a value differing from Toronto's is explained rather than appearing as a glitch.
3. While the non-Toronto fetch is in flight, times keep their server-rendered values and the strip marks itself `aria-busy="true"`; values are replaced in one update, never digit-by-digit.
4. **The eruv row is hidden for non-Toronto locations.** Eruv status in the database is Toronto's; showing it under another city's heading would be wrong.
5. Fetch failure leaves the Toronto values in place and logs `[HERO]`-prefixed console output. No error UI in the hero.
6. **The dial's tick ring shifts too, and that is already handled by §1.** Elapsed ticks are never server-rendered — every tick starts as *upcoming* and the elapsed boundary is computed after mount from the resolved location's `tzid`. So a non-Toronto visitor's ring is correct on its first painted state rather than correcting itself, and there is no second visible change.

---

## 6. Motion and accessibility

- **Pause on interaction.** The RAF loop skips its angle increment while a pointer is inside the dial container or while focus is within it (`focusin` / `focusout`). A moving link becomes stationary exactly when someone tries to click it. The current rotating links are a WCAG 2.2.2 (Pause, Stop, Hide) failure and a motor-accessibility problem.
- **`prefers-reduced-motion: reduce`** → the RAF loop never starts; one static frame is painted; `LightRays` is not mounted, replaced by a static gradient plus SVG grain.
- **Below `md`** → no dial, no WebGL. Mobile order: strip → `<h1>` → search → **destination chips** → stat line. Nothing 300px tall between the headline and the content.
- **Mobile chips are the first three entries of `heroNodes.ts`** — Shuls, Zmanim, Events — rendered as links to their `href`. They are a `.slice(0, 3)` of the single source of truth, not a second hardcoded list.
- **The "Popular:" search chips (§1) are hidden below `md`.** Two rows of chips on a phone reads as noise, and the destination chips are the more useful of the two. So: mobile shows destination chips only; `md` and above shows "Popular:" chips under the search field and the destinations live in the dial.
- Each disc is a real `next/link` `<a>` with an `aria-label` combining label and description ("Shuls — 38 shuls in Toronto"), and a visible `focus-visible` ring.
- The tick ring is decorative: `aria-hidden="true"`.
- Hub text changes on hover are cosmetic only; the accessible name of each link never depends on hub state.

---

## 7. `LightRays` integration

- Vendored into `src/components/home/hero/LightRays.tsx` from React Bits (MIT + Commons Clause — use in a product is permitted; reselling the components is not). Attribution comment retained at the top of the file.
- `ogl` added to `dependencies`.
- Loaded via `next/dynamic` with `ssr: false`.
- **Not mounted** when `prefers-reduced-motion: reduce`, or below the `md` breakpoint. Both conditions are evaluated client-side after mount; the static gradient renders until then, so there is no WebGL work on mobile at all.
- Tuned to the site's navy/cyan palette, not the component's defaults.
- A static navy gradient with an SVG turbulence grain overlay is the permanent fallback layer beneath it — this also fixes banding visible in the current flat `from-blue-950 via-blue-900` gradient on low-quality displays.

---

## 8. Deletions

From `HeroSection.tsx`: the `starParticles` array (lines 35–66), the `useCountUp` hook (lines 82–136), the `activeConnections` interval (lines 236–247), the per-node `color` gradient field, the four-button CTA row (lines 479–508), the scroll indicator (lines 513–524), and the `/api/stats` client fetch (lines 224–229).

From `src/app/globals.css` — each grepped across `src/**/*.tsx` and confirmed to appear **only** in `HeroSection.tsx`:

`star-twinkle` (keyframes + class), `shimmer-effect` (+ `shimmer` keyframes), `animate-pulse-ring` and `animate-pulse-ring-delayed` (+ `pulse-ring` keyframes), `animate-gradient-shift` (+ `gradient-shift` keyframes), `animate-bounce-slow` (+ `bounce-slow` keyframes). Also `animate-pulse-ring-slow` and `pulse-ring-expand`, which are already unreferenced anywhere in the codebase.

`/api/stats/route.ts` **becomes dead code and is deliberately kept.** Grepped: `HeroSection.tsx:225` is its only caller anywhere in `src/`, so removing that fetch leaves the route unreferenced. It is left in place rather than deleted — deleting a working public endpoint is a separate decision for the owner, and the route costs nothing while unused. This is a conscious deferral, not an unchecked assumption.

---

## 9. Testing

**`tests/unit/hero-dial.test.ts`** against `src/lib/hero/dial.ts` (Vitest `unit` project is already configured):

- `getTickMarks` returns exactly 72 marks; every mark's endpoints lie on the expected radii; every sixth mark is longer than its neighbours.
- `getTickMarks` elapsed flags: `minutesElapsed = 0` → zero elapsed; `1440` → all 72 elapsed; `19` → zero elapsed; `20` → exactly one; `1439` → 71.
- `getNodePosition` distributes 8 nodes at 45° intervals; `angleDeg = 360` is identical to `angleDeg = 0`; all results stay within 0–100.
- `minutesElapsedInDay` is computed in the supplied `tzid`, not the runner's local zone: a single UTC instant yields different values for `America/Toronto` and `Asia/Jerusalem`. Result is clamped to 0–1440.

**`tests/unit/hero-primary-zman.test.ts`** against `src/lib/hero/primaryZman.ts`:

- Friday (`candleLighting` set) → that time, label `Candle lighting`.
- Saturday (`havdalah` set, `candleLighting` null) → havdalah, label `Havdalah`.
- Tuesday (both null, `upcomingCandleLighting` set) → upcoming, label `Candle lighting Fri`.
- All three null → returns `null` (which drives the wordmark fallback).
- The function never returns a `PrimaryZman` whose `time` is null or an invalid `Date`.

**Not unit-tested:** the RAF loop, pause-on-hover, WebGL mounting, and font loading. `@testing-library/react` and `@testing-library/jest-dom` *are* devDependencies, but `jsdom` is not installed and `vitest.config.mts` sets `environment: 'node'` — so there is no DOM environment to render into. Standing one up is out of scope here; component behaviour is verified in a real browser instead, consistent with the zmanim location picker work. Checklist:

1. Ring rotates; hovering the cluster stops it; leaving resumes it.
2. Keyboard-tabbing into a disc stops rotation; tabbing out resumes it.
3. Hovering a disc changes hub text; leaving restores the candle-lighting time.
4. Discs stay upright through a full lap; labels never rotate.
5. OS "reduce motion" on → nothing animates and no WebGL canvas exists in the DOM.
6. At 375px width → no dial, no canvas, correct stacking order.
7. Hebrew renders in Assistant/Frank Ruhl Libre (not an OS font) on the hero strip, `/community/calendar`, and `/community/tehillim`.
8. With `ft_zmanim_location` set to Jerusalem → strip shows the location name, times update once, eruv row absent.
9. On a **non-Friday**, hub and strip show the upcoming Shabbos lighting labelled `Candle lighting Fri` — not `--:--` and not an empty hub.
10. Hard-reload twice several minutes apart in production build → candle lighting, eruv and counts differ from the build-time values, confirming `force-dynamic` took effect.
11. Hebrew headline text (`font-display`) renders in Frank Ruhl Libre, not the sans fallback — the check that catches the circular-variable mistake in §4.
12. `eslint` and `tsc` at 0 errors before commit.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Site-wide font change affects every page, not just the hero | Assistant's metrics are close to Urbanist's; visual pass over `/`, `/directory`, `/shuls`, `/zmanim`, an admin page, and one email preview before commit. Email templates use their own inline stacks and are unaffected. |
| `ogl` WebGL context fails or is refused on a low-end device | The static gradient + grain layer always renders beneath; `LightRays` failing to mount degrades to it silently. |
| Non-Toronto visitors see a value swap in the hero | §5, items 1–5. |
| 0.5°/sec still feels like motion to some visitors | Rotation is a single named constant; reduced-motion users get zero motion regardless. |
| Dropping Shiva from the dial reduces its discoverability | It stays in the nav dropdown and in `QuickLinks`; the strip and dial are not the only paths to it. |
