# Homepage Hero Redesign — "The Dial"

**Date:** 2026-07-26
**Status:** Approved for planning
**Scope:** (1) the homepage hero — `src/components/home/HeroSection.tsx` and its direct dependencies; (2) the site-wide font change required to render Hebrew correctly; (3) **site-wide correction of the zmanim day boundary** in `src/lib/zmanim.ts` (§11), which the hero surfaces above the fold for the first time.

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
- No change to the zmanim location picker UI, and **no change to which halachic opinion any zman uses** — no new degrees, no new minute offsets, no relabelling. §11 changes *which calendar day* is computed, never *how* a time is computed.
- Additive, in scope, specified below: three ISO fields on the `mode=today` response of `/api/zmanim` (§3), and an `isHydrated` return value on the shared `useStoredZmanimLocation` hook (§2). Neither alters an existing consumer.
- §11 **does** change displayed values on `/zmanim`, `ZmanimWidget`, `/api/zmanim` and the calendar pages during evening hours. That is the fix, not a side effect.

---

## Design decisions (confirmed with owner, 2026-07-26)

| Decision | Choice | Notes |
|---|---|---|
| Right-hand treatment | **The Dial** | Tick-marked instrument ring; rejected alternatives were a Today panel, a quiet 3×3 grid, a centred layout with nothing on the right, a static constellation, and an abstract neighbourhood map. |
| Typeface | **Frank Ruhl Libre (display) + Assistant (UI/body)** | Explicitly overrides the global `CLAUDE.md` preference for Urbanist. Both cover Hebrew. |
| Background | **React Bits `LightRays`** | Adds `ogl`. Gated — see §7. |
| Live strip above the fold | **Yes** | Candle lighting · eruv · Hebrew date. |
| Location for displayed times | **Follows the visitor's saved zmanim location** | Owner chose this over always-Toronto, accepting the tradeoff in §5. |
| Zmanim day boundary | **Fixed site-wide, in this spec** | Owner chose this over a hero-only fix or a separate ticket. See §11. |

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

The final row exists so no code path can render `"--:--"`. The resolver returns `{ time: Date; label: string } | null`; a `null` return is what triggers the wordmark fallback.

Two guarantees make that airtight: the resolver takes `Date | null` inputs and never sees a formatted string, and the client receives raw ISO values rather than `formatZmanTime()` output — which returns the **truthy** sentinel `"--:--"` for a null time (§3). This is the only invented rule in the spec and it is confined to one function.

### The dial

- A hairline ring with **72 tick marks**, one per 20 minutes of the day (72 × 20 min = 1440 min). Every sixth tick (each two hours) is longer.
- Ticks for elapsed time today are rendered at low opacity; upcoming ticks at higher opacity.
- **Elapsed ticks are computed client-side only, and only once the stored location is known.** On the server, and on every client render until `isHydrated` is true (§2), every tick renders as *upcoming* — so server and client markup agree and there is no hydration mismatch. Once `isHydrated` is true, `minutesElapsedInDay(new Date(), tzid)` runs against that `tzid` and the ring updates, then re-runs **every 60 seconds** so a 20-minute boundary is never more than a minute stale. The interval is cleared on unmount. Gating on `isHydrated` rather than on mount prevents painting against Toronto and then jumping; gating on it rather than on the fetch keeps the ring working when the network doesn't.
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
| `src/lib/hero/primaryZman.ts` | — | **Pure.** `resolvePrimaryZman()` — the candle-lighting/havdalah/upcoming fallback chain. | `lib/zmanim` **(types only)** |
| `src/components/home/hero/heroNodes.ts` | — | The eight destinations: `id`, `label`, `href`, `icon`, `description`, optional `countKey`. | `lucide-react` |
| `src/components/home/hero/HeroSection.tsx` | **Server** | Layout shell. Receives all server data as props, renders `HeroLiveData` and `HeroSearch`. Holds no state. | the units below |
| `src/components/home/hero/HeroLiveData.tsx` | **Client** | **Owns the resolved location** and everything derived from it. A *context provider* that renders `{children}` — it imposes no layout. Calls `useStoredZmanimLocation()`, performs the non-Toronto fetch, resolves the primary zman, and exposes `{ location, primaryZman, eruv, counts, isHydrated, isTimesResolved }` via context. | `useStoredZmanimLocation`, `lib/hero/primaryZman` |
| `src/components/home/hero/LiveStrip.tsx` | **Client** | Presentational. Reads the context; renders zman + eruv + Hebrew date. No fetching, no location logic. | `HeroLiveData` context |
| `src/components/home/hero/CommunityDial.tsx` | **Client** | RAF orbit loop, tick rendering, hub state, hover/focus pause. Reads zman + counts + `tzid` from context. | `lib/hero/dial`, `HeroLiveData` context |
| `src/components/home/hero/HeroSearch.tsx` | **Client** | Wraps `UniversalSearch`, renders popular chips. Owns the `useRouter` call that currently lives in `HeroSection`. | `UniversalSearch` |
| `src/components/home/hero/LightRays.tsx` | **Client** | React Bits component, vendored. Gated renderer. | `ogl` |

`HeroLiveData` exists specifically to resolve the ownership question: the strip and the dial both display location-dependent times, and siblings cannot pass props to each other. It is the single client boundary that owns the location, and it is what makes §5 coherent. Its props are the server-rendered Toronto values; its state is the resolved location plus whatever times that location produced.

**It is a context provider, not a layout wrapper.** It renders `{children}` and nothing else, so §1's composition is unaffected: `HeroSection` (server) renders `<HeroLiveData>` around the whole hero body, then lays out the strip full-width and the two columns beneath it exactly as §1 describes. `LiveStrip` and `CommunityDial` consume the context wherever they sit in the tree. A prop-passing wrapper was rejected because it would have forced `HeroLiveData` to own the two-column layout and receive the server-rendered left column through a slot — moving the ownership problem into a layout problem.

**Gating, so nothing visibly jumps.** `useStoredZmanimLocation` returns `TORONTO_LOCATION` on first client render and hydrates from `localStorage` in an effect, and it currently offers **no way to tell "not yet hydrated" from "no saved location"**. Without a signal, the dial would compute elapsed ticks with Toronto's `tzid` and then recompute when a stored location landed — for Jerusalem a 7-hour offset, roughly 21 ticks, a very visible jump. Two changes prevent it:

1. **`useStoredZmanimLocation` gains a third, additive return value: `isHydrated: boolean`.** Existing consumers destructure `[location, setLocation]` and are unaffected. This is a deliberate, stated exception to the non-goal below — the hook is shared with the zmanim page and widget, and the change is additive only.
2. **Two separate gates, because the ring and the times have different dependencies.** `minutesElapsedInDay` needs only a `tzid`, which comes from `localStorage` with no network involved; the displayed times need the fetch.
   - **Ticks gate on `isHydrated` alone.** As soon as the stored location is known, the ring computes against that `tzid`. It never waits on a network request it does not need.
   - **Times gate on `isTimesResolved`** = `isHydrated` **and** (location is Toronto **or** the fetch has settled).
   - **A failed fetch counts as settled.** Per §5 item 5 the Toronto times are retained; `isTimesResolved` becomes true either way. Without this, a visitor with a saved non-Toronto location on a flaky connection would be stuck in a permanent loading state — and under the earlier single-gate design, would have had an all-upcoming ring forever.

`HeroSection.tsx` becomes a **server component** — the `useRouter` call that forces `"use client"` today moves into `HeroSearch`.

### `src/lib/hero/primaryZman.ts` interface

```ts
export interface PrimaryZman { time: Date; label: string }

export interface PrimaryZmanInput {
  candleLighting: Date | null;
  havdalah: Date | null;
  upcomingCandleLighting: Date | null;
}

/** Applies the fallback chain in §1. Returns null when no zman is available. */
export function resolvePrimaryZman(input: PrimaryZmanInput): PrimaryZman | null
```

**Three `Date | null` inputs; no `location`, no `now`, no runtime dependency on `lib/zmanim`.** The caller supplies all three values, so the function is pure and callable from either side of the client boundary. Any import from `lib/zmanim` here is **type-only** (`import type`), which erases at compile time. An earlier draft gave this function a `location` parameter and had it call `getUpcomingShabbat()` itself — that would make it impure and pull `@hebcal/core` into the client bundle via `HeroLiveData`. It does not.

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
`HeroLiveData` calls the existing `useStoredZmanimLocation()` hook. If it returns Toronto (the default, and the case with no `localStorage` entry), nothing further happens — no request, no re-render of times. If it returns a non-Toronto location, it fetches `/api/zmanim?lat=…&lon=…&tzid=…&label=…&il=…` (the route already accepts and validates these), re-runs `resolvePrimaryZman()` on the result, and exposes the new values via context in one update.

**The hero adds no `@hebcal/core` to the client bundle.** (It is already there site-wide via `OmerWidget` and `ShulEventsCalendar`, both `"use client"` — so this is a statement about the hero's own contribution, not an existing guarantee.) `resolvePrimaryZman` is pure: it takes `candleLighting`, `havdalah` and `upcomingCandleLighting` as `Date | null` inputs and picks one. The server supplies the third from `getUpcomingShabbat(TORONTO_LOCATION)`.

**An additive API change is required, and it must carry raw ISO values — not formatted strings.**

The `mode=today` branch of `/api/zmanim` currently passes every time through `formatZmanTime()` before responding, so `candleLighting` reaches the client as `"7:12 PM"`. Critically, **`formatZmanTime(null)` returns the string `"--:--"`**, which is truthy. A resolver receiving the existing wire shape would take branch 1 on a Tuesday and render `--:--` in the hub — the precise outcome the fourth row of the fallback table exists to prevent. (`ZmanimWidget:95` already guards this with `data.candleLighting !== "--:--"`, confirming the sentinel leaks to consumers today.) A formatted string also cannot be reparsed into a `Date` for the resolver.

So the `mode=today` response gains three fields **alongside** the existing formatted ones:

```ts
candleLightingISO: string | null          // raw ISO 8601, or null — never "--:--"
havdalahISO: string | null
upcomingCandleLightingISO: string | null  // from getUpcomingShabbat(location)
```

`HeroLiveData` parses these into `Date`s (or keeps `null`) and passes them to `resolvePrimaryZman`. The sentinel string never reaches the resolver.

**`upcomingCandleLightingISO` is always relative to *now*, never to the route's `date` parameter.** `getUpcomingShabbat()` calls `new Date()` internally (`zmanim.ts:209`) and ignores any date passed to it. The hero never sends `date`, so there is no live bug — but the field's semantics are stated here so a future caller doesn't assume `?date=2026-08-01` shifts it.

`getUpcomingShabbat(location)` **already accepts a location parameter**, so no new halachic logic is introduced and no existing behaviour changes. All three fields are purely additive — the only consumers of this route are `ZmanimWidget` (`mode=today`) and `ZmanimPageContent` (`mode=week`), and neither breaks on added fields. The route's separate `mode=shabbat` branch remains hardcoded to Toronto and is **not** touched (verified: zero callers).

Without this, non-Toronto visitors would lose the zman segment on every non-Friday — a silent regression, which is why it is specified rather than deferred.

Because `HeroLiveData` owns the location, the strip and the hub cannot disagree: there is one resolved value and both read it from the same context.

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
6. **The dial's tick ring is gated on `isHydrated` (§2), not on the fetch.** Elapsed ticks are never server-rendered — every tick starts as *upcoming*, and the boundary is computed as soon as the stored `tzid` is known. Without a gate the ring would paint against Toronto and then jump (~21 ticks for Jerusalem); gating on the fetch instead would strand the ring whenever the network failed.

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
3. Hovering a disc changes hub text; leaving restores the primary zman (which is not candle lighting on most days — see item 9).
4. Discs stay upright through a full lap; labels never rotate.
5. OS "reduce motion" on → nothing animates and no WebGL canvas exists in the DOM.
6. At 375px width → no dial, no canvas, correct stacking order.
7. Hebrew renders in Assistant/Frank Ruhl Libre (not an OS font) on the hero strip, `/community/calendar`, and `/community/tehillim`.
8. With `ft_zmanim_location` set to Jerusalem → strip shows the location name, times update once, eruv row absent.
9. On a **non-Friday**, hub and strip show the upcoming Shabbos lighting labelled `Candle lighting Fri` — not `--:--` and not an empty hub.
10. Hard-reload twice several minutes apart in production build → candle lighting, eruv and counts differ from the build-time values, confirming `force-dynamic` took effect.
11. Hebrew headline text (`font-display`) renders in Frank Ruhl Libre, not the sans fallback — the check that catches the circular-variable mistake in §4.
12. §11's manual verification list (Toronto morning + after 8 PM, Jerusalem, the `/zmanim` date picker, a Friday and a Saturday evening) all pass against MyZmanim.
13. `eslint` and `tsc` at 0 errors before commit.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Site-wide font change affects every page, not just the hero | Assistant's metrics are close to Urbanist's; visual pass over `/`, `/directory`, `/shuls`, `/zmanim`, an admin page, and one email preview before commit. Email templates use their own inline stacks and are unaffected. |
| `ogl` WebGL context fails or is refused on a low-end device | The static gradient + grain layer always renders beneath; `LightRays` failing to mount degrades to it silently. |
| Non-Toronto visitors see a value swap in the hero | §5, items 1–5. |
| 0.5°/sec still feels like motion to some visitors | Rotation is a single named constant; reduced-motion users get zero motion regardless. |
| Dropping Shiva from the dial reduces its discoverability | It stays in the nav dropdown and in `QuickLinks`; the strip and dial are not the only paths to it. |
| `getUpcomingShabbat()` runs `getZmanimForDate` twice (Friday + Saturday), each a full `HebrewCalendar.calendar()` plus a complete `Zmanim` set — so it roughly triples hebcal work on both the now-uncached homepage render and every `mode=today` API response | Cheap in absolute terms (pure computation, no I/O). Measure the homepage TTFB before and after; if it registers, memoise per (date, location) for the request's lifetime. |
| **§11 changes displayed halachic times site-wide.** A mistake in the anchoring would be wrong times on every zmanim surface — the highest-consequence risk in this spec | Existing `zmanim-calc` / `zmanim-api-route` assertions must pass **unchanged** (any midday diff means the anchoring is wrong); new fixed-instant tests cover the evening and DST cases; and the full MyZmanim comparison is repeated for Toronto and Jerusalem, morning and evening, before commit. |
| §11 could shift the `/zmanim` date picker by a day — the classic failure of a blunt timezone normalisation | The two-meanings split (`todayInLocation` vs `anchorCalendarDate`) exists precisely for this, with a dedicated unit test and manual check 4. |
| Noon-UTC anchoring assumes a server offset within (−12, +12) | True for production (UTC) and every realistic dev machine; stated as a limitation in §11 rather than defended against. |
| `next/font/google` subset names for `Frank_Ruhl_Libre` / `Assistant` unverified offline | Both ship Hebrew on Google Fonts, and an invalid subset name fails the build loudly rather than silently — confirm on the first `next build`. |

---

## 11. Zmanim day-boundary correctness (site-wide)

### The bug

Every calendar-day decision in `src/lib/zmanim.ts` is made from the **server's** local clock rather than the location being displayed. On Vercel the server is UTC and Toronto is UTC−4 in summer, so from roughly 8:00 PM Toronto time the server's date has already rolled over and the site reports **tomorrow**.

Verified sites in `getZmanimForDate` (line numbers as of `1d5ff78`):

| Line | Expression | What it decides |
|---|---|---|
| 54 | `new Zmanim(hebcalLoc, date, false)` | which day's sunrise/sunset, and therefore every zman |
| 55 | `new HDate(date)` | the Hebrew date and `renderGematriya()` output |
| 62–64 | `HebrewCalendar.calendar({ start: date, end: date, … })` | parsha, candle lighting, havdalah, Yom Tov, fasts |
| 93 | `date.getDay()` | whether candle lighting means Friday or Yom Tov eve |
| 121 | `date.getDay()` | whether the day is Shabbos |

**Line 144 is already correct** — `toLocaleDateString(..., { timeZone: location.tzid })`. So the English date is right while the Hebrew date, the parsha and every zman for that day can be a day ahead. That internal inconsistency is the clearest evidence this is a defect rather than a deliberate choice.

Also affected: `getZmanimForWeek` (defaults to `new Date()`, then does `setDate` arithmetic on server-local components) and `getUpcomingShabbat` (calls `new Date()` and `today.getDay()`, line 209). And `src/app/api/zmanim/route.ts:83` does `new Date(dateParam)`, which parses `"2026-07-26"` as UTC midnight — correct today only because the server happens to be UTC.

### Two meanings, currently tangled

The root cause is that one representation is carrying two different intents:

1. **"Today, in the displayed location"** — an *instant*, which must be converted to that location's civil day.
2. **"The specific date the user picked"** — a *calendar day*, which must **not** be shifted by any timezone conversion.

Both currently resolve through the server's local components. A single blunt normalisation breaks meaning 2: converting a picked "Aug 1" through a timezone can land on July 31. The fix must therefore separate them explicitly.

### The fix — `src/lib/zmanim-day.ts` (new, pure)

```ts
/** The civil calendar date at `instant` as observed in `tzid`. */
export function civilDateInTimeZone(
  instant: Date,
  tzid: string,
): { year: number; month: number; day: number }

/** A Date anchored at 12:00 UTC on the given civil date. */
export function anchorCivilDate(civil: { year: number; month: number; day: number }): Date

/** Meaning 1 — "today" in the location. */
export function todayInLocation(location: ZmanimLocation, now?: Date): Date

/** Meaning 2 — an explicit calendar date, re-anchored without shifting the day.
 *  Reads the server-local Y/M/D of `date`. Safe for any Date whose server-local Y/M/D
 *  already denotes the intended civil day — which covers both local-component
 *  construction (`new Date(2026, 7, 1)`) and noon-UTC instants
 *  (`new Date('2026-08-01T12:00:00Z')`, the form used by existing test fixtures). */
export function anchorCalendarDate(date: Date): Date
```

`civilDateInTimeZone` uses `Intl.DateTimeFormat(..., { timeZone: tzid }).formatToParts` — no new dependency.

**Why anchor at 12:00 UTC.** hebcal's `HDate`, `Zmanim` and `HebrewCalendar.calendar` all read a `Date`'s **local** components to determine the civil day — verified at source: `HDate` documents "using local time… hours, minutes, seconds and milliseconds are ignored" and routes through `greg2abs` → `getFullYear/getMonth/getDate`; the `Zmanim` constructor builds a `Temporal.PlainDate` from those same local getters and uses `location` for lat/lon only; `HebrewCalendar.calendar({start, end})` reaches `greg2abs` too. **Nothing reads the instant.**

The invariant we need is therefore "this Date's server-local Y/M/D equals the intended civil day". Noon UTC satisfies that for every server offset in **[−12, +12)**: 12:00 ± offset never crosses midnight. Anchoring at midnight would not — any negative offset flips the day.

**Stated limitation:** the interval is closed at −12 and **open at +12**. At exactly UTC+12:00 (Auckland standard time, Fiji, Kamchatka) noon UTC is already 00:00 the following day, so the invariant fails there — not only at +13/+14. This constrains the **server's** offset, not the viewer's location: a Toronto server rendering Auckland zmanim is fine. Production is UTC and every realistic dev machine is inside the safe interval. Documented rather than defended against.

Anchoring does **not** affect the times themselves. `Zmanim` derives sunrise/sunset from lat/lon for a civil day and returns absolute instants; `tzid` only matters at display time. So §11 changes *which day* is computed and nothing about *how*.

### Call-site changes

| Site | Change |
|---|---|
| `getZmanimForDate(date?, location)` | `date` becomes optional. First line: `const dayDate = date ? anchorCalendarDate(date) : todayInLocation(location)`. Lines 54, 55, 62–64, 93, 121 use `dayDate`. |
| line 144 (English date) | formats `dayDate` with `timeZone: "UTC"` — the anchor already *is* the intended civil day, so converting it through `location.tzid` would reintroduce a shift for locations at large positive offsets. |
| `getZmanimForWeek(startDate?, location)` | `startDate` optional; base becomes `startDate ? anchorCalendarDate(startDate) : todayInLocation(location)`. Day *i* is derived by adding *i* days to the **civil date** and re-anchoring — not by `setDate` on a Date object. To be precise about why: `setDate` does **not** produce a day error today; it preserves local wall time, so across a DST transition the anchored *instant* drifts by an hour (12:00Z → 13:00Z for a week from 2026-10-30, → 11:00Z from 2026-03-06). Since hebcal ignores time-of-day, that drift is currently harmless. Civil-date arithmetic is still required because it holds every anchor at exactly 12:00Z, so the safety margin never erodes — drift only becomes a day error once the anchor sits within an hour of local midnight (|offset| ≥ 11h), and re-anchoring makes that unreachable. |
| `getUpcomingShabbat(location)` | replaces `new Date()` / `today.getDay()` with `todayInLocation(location)` and that date's day-of-week. |
| `/api/zmanim` route line 83 | An explicit `date` param is parsed with **`civilDateInTimeZone(instant, "UTC")`** — explicitly UTC, not `location.tzid` — then passed through `anchorCivilDate`. Absent `date` → omit the argument and let `getZmanimForDate` call `todayInLocation`. **Parsing in `location.tzid` would be a bug:** a Toronto viewer picking Aug 1 sends `2026-08-01T16:00:00Z`, which is Aug **2** in `Pacific/Auckland`. |
| `/api/zmanim` route line 115 | `getUpcomingShabbat()` is called with **no** location argument, relying on the Toronto default. Harmless today (that branch is Toronto-only by design and has zero callers), but it must be passed `location` if it is ever wired up. Left as-is; noted so it is not mistaken for an oversight. |
| `ZmanimPageContent` — `getStartOfWeek` (lines 52–58) | **Change `setHours(0, 0, 0, 0)` to `setHours(12, 0, 0, 0)`.** The picked date is built at local noon (line 129), but `getStartOfWeek` then zeroes the time before line 77 serialises it with `.toISOString()` — so the wire value is local **midnight**. A UTC civil-date parse recovers the intended day for negative-offset viewers (all of the Americas) but is off by one for positive offsets: a viewer at UTC+5:30 picking Sunday sends Saturday 18:30Z. Anchoring the week start at local noon makes the UTC parse correct for any viewer offset in (−12, +12). |
| `src/app/(public)/community/calendar/[id]/page.tsx:79` | `new HDate(date)` on an event's stored timestamp — same bug class. Routed through the shared helper so the event's Hebrew date is derived from its civil day rather than the server's. |
| `src/app/api/businesses/[id]/shoutouts/route.ts:30` | `isChag()` does `new HDate(date)` on a server instant — same bug class, and it gates real behaviour rather than display. Routed through the shared helper. |

Public signatures stay source-compatible: every existing caller keeps working, and `date`/`startDate` going from defaulted to optional is not a breaking change.

### Coverage

Grepped across `src/`, `tests/` and `scripts/`: the only callers of `getZmanimForDate`, `getZmanimForWeek` and `getUpcomingShabbat` are `src/app/api/zmanim/route.ts` (lines 87, 115, 133), `tests/unit/zmanim-calc.test.ts`, and the new `page.tsx` / `HeroLiveData` from this spec. The call-site table covers all of them.

Four other places derive a Hebrew day independently. Two are already safe and stay untouched:

- `src/app/(public)/community/calendar/page.tsx:65,74,76` — `new HDate(new Date(year, month, day))`, explicit local components. **Safe.**
- `src/components/widgets/OmerWidget.tsx:10` and `src/components/shuls/ShulEventsCalendar.tsx:55,61` — client components, so they read the *viewer's* local time, which is the correct behaviour there. **Safe.**

The other two read a server instant and are in scope (see the call-site table). They are included because leaving them out would make §9's manual check 1 — "the hero strip and `/community/calendar` agree with each other" — fail in the evening for reasons this spec claims to fix.

**The client's local-noon convention is now load-bearing.** `ZmanimPageContent` line 129 (`new Date(val + "T12:00:00")`) and the amended `getStartOfWeek` must both keep a mid-day local anchor; "simplifying" either to `new Date(val)` or back to `setHours(0,…)` silently reintroduces an off-by-one day for some viewers. Both sites get a code comment saying so.

### Tests — `tests/unit/zmanim-day.test.ts`

Timezone-independent: each case asserts on a fixed instant, never on the runner's clock.

- `civilDateInTimeZone`: `2026-07-25T00:30:00Z` → `America/Toronto` gives **2026-07-24** (8:30 PM Friday) and `Asia/Jerusalem` gives **2026-07-25** (3:30 AM Saturday). Same instant, two civil days — the bug in one assertion.
- `anchorCivilDate`: returns 12:00 UTC; the round trip `civilDateInTimeZone(anchorCivilDate(c), "UTC")` equals `c`.
- `anchorCalendarDate`: a Date built from local components keeps its Y/M/D.
- `todayInLocation`: with `now = 2026-07-25T00:30:00Z`, Toronto yields the Friday anchor and Jerusalem the Saturday anchor.
- **DST, with a discriminating assertion.** "Seven distinct consecutive dates" is *not* sufficient — `setDate` passes that too. Instead: for weeks starting `2026-10-30` (DST ends) and `2026-03-06` (DST starts), assert every one of the seven anchors has an ISO time of exactly `12:00:00.000Z`. Civil-date arithmetic holds 12:00Z throughout; `setDate` drifts to 13:00Z / 11:00Z, so this assertion fails against the wrong implementation. Seven distinct consecutive civil dates is asserted as well.
- The `+12` boundary: `anchorCivilDate` output read back at a simulated server offset of exactly `+12:00` lands on the following day — asserted so the documented limitation is pinned rather than folklore.

### Tests — additions to `tests/unit/zmanim-calc.test.ts`

**The clock must be injected with `vi.useFakeTimers()` / `vi.setSystemTime()`, torn down with `vi.useRealTimers()`.** `getZmanimForDate(undefined, location)` gives a test no parameter through which to pass `now` — `todayInLocation`'s optional `now` is not reachable from there — so "with the clock at X" is only implementable via fake timers.

- **The evening case, end to end.** With the clock at `2026-07-25T00:30:00Z`, `getZmanimForDate(undefined, TORONTO_LOCATION)` returns Friday's Hebrew date, Friday's parsha and a **non-null** `candleLighting`, with `isShabbat` reflecting Friday — not Saturday's values.
- The same instant for a Jerusalem location correctly returns **Saturday** (it genuinely is Saturday there), with `havdalah` non-null.
- `getUpcomingShabbat(TORONTO_LOCATION)` at Friday 8:30 PM ET returns **that** Shabbos, not the following week's. Also fake-timer driven.
- **The route's `date` param** — the highest-risk seam, and the only one whose failure mode is silently wrong-by-a-day: `?mode=today&date=2026-08-01T16:00:00Z` returns **Aug 1** regardless of the runner's timezone. Add to `tests/unit/zmanim-api-route.test.ts`.
- **Regression:** every existing assertion in `zmanim-calc.test.ts` and `zmanim-api-route.test.ts` passes **unchanged**. This works because those fixtures are already noon-UTC instants (`new Date('2026-07-14T12:00:00Z')`) and noon-UTC anchoring keeps their server-local reads stable for any runner in the safe interval — that property is the entire basis of the regression check. Any diff in a midday Toronto value means the anchoring is wrong.

**Sequencing note:** §3's three ISO fields and §11's `date`-param case both land in `tests/unit/zmanim-api-route.test.ts`. Land §11's first (it is the earlier phase), then §3's, so the two do not collide.

### Manual verification (required before commit)

Repeat the July MyZmanim comparison, since this changes displayed halachic times:

1. Toronto, **morning** — `/zmanim`, `ZmanimWidget`, hero strip, `/community/calendar`, and a single event's detail page (`/community/calendar/[id]`) all agree with MyZmanim and with each other. The event detail page is included because its `HDate` derivation is now routed through the shared helper.
2. Toronto, **after 8:00 PM ET** — the same four surfaces still show **today**, not tomorrow. This is the case that is broken today.
3. Jerusalem via the location picker — same two checks in that timezone.
4. `/zmanim` **date picker**: selecting a date shows that date, in any server timezone. This is the regression the two-meanings split exists to prevent.
5. A Friday evening and a Saturday evening, since those are where `isShabbat` / `havdalah` flip.
6. `/zmanim` week navigation (previous/next week arrows) still lands on the intended weeks after the `getStartOfWeek` change.

### Sequencing

**§11 is its own phase, executed, verified and committed before any hero or typography work.** It is a change of comparable risk to the rest of the spec combined: a new pure module, five edits inside the most safety-critical file in the repo, two adjacent `HDate` call sites, a route change, a client change, cases across two test files, and a full MyZmanim re-verification — affecting four user-facing surfaces the hero never touches. The hero's server render depends on corrected behaviour, and an anchoring mistake must be isolated in its own diff rather than interleaved with a font swap and a vendored WebGL component.
