# Homepage Ads — Design

**Date:** 2026-07-30
**Status:** Design, awaiting approval
**Trigger:** Client asked whether a TorahMasters semicha flyer could go on the front page. It could not — the answer is why this exists.

---

## 1. The problem

Today an ad is not a record. It is a column: `businesses.banner_image_url`, shown if the
business's plan has `show_in_homepage_banner` / `show_in_homepage_sidebar`, selected with
`ORDER BY random()`.

That shape is a **perk** ("Premium gets homepage exposure"), not **advertising**. It cannot
express an advertiser who is not a business, a chosen link target, two ads for one advertiser,
a list of what is running, a fixed run period, or deliberate ordering. A semicha programme has
no business listing, so there is no row to hang a flyer on.

`homepage_ads` (migration `2026-07-30-homepage-ads.sql`, already applied to primary and the
test branch) makes an ad a record. This design covers everything above that table.

---

## 2. Decisions taken

| Question | Decision |
|---|---|
| Who can advertise | Paid for businesses, free for community organisations |
| Positions | **Three independent**: `banner`, `sidebar-left`, `sidebar-right` |
| Rotation | Everything rotates, including hand-placed ads — 5s banner, 6s sidebar |
| Ordering | **Random within a position.** No pinning, no manual ordering |
| Pool size | 3 picked at random per render, from everyone eligible for that position |
| Business ads | Business uploads, admin approves; approved ads join the pool |
| Community orgs | Admin uploads on their behalf — no advertiser accounts |
| Link | Chosen per ad: business page / external URL / no link |
| Image fit | **Letterbox as supplied**, with an admin warning on a bad shape |
| Display | Thumbnail → full-flyer overlay → button to the destination |
| Mobile | Banner stays; both sidebars merge into the single mobile strip |
| Empty position | Keeps the existing "Advertise Here" placeholder, in all three |
| Ad label | **None.** The existing "Sponsored" captions are removed |
| Admin page | `/admin/businesses/ads` — a fourth tab in the Businesses group |

**The single lever is position.** You decide whether an ad is top, left or right. Everything after
that is equal treatment — no ad can jump the queue, including your own hand-placed flyers.

---

## 3. Left and right are currently the same thing

`HomepageSidebarAds` takes `position: "left" | "right"`, but both instances fetch the identical
`?placement=sidebar&limit=3`, and the `position` prop is **declared, destructured, and never
read** — not even for styling. The two columns render byte-identical content, mirrored.

So "put this ad on the right" is a new capability, not an exposed setting. Three positions also
**doubles sidebar inventory**, because the columns stop duplicating each other.

**Change:** `placement` becomes `banner` | `sidebar-left` | `sidebar-right`. The CHECK
constraint and `AdPlacement` in `src/lib/ads/live-ads.ts` are updated; any existing `sidebar`
row maps to `sidebar-left`. `HomepageSidebarAds` starts actually using its `position` prop.

---

## 4. Selection: random, three per position

Every ad eligible for a position is equal. Each render picks **3 at random** from that pool and
rotates through them.

```sql
WHERE <liveAdCondition(placement, now)>
ORDER BY RANDOM()
LIMIT 3
```

**Why random is right here and wrong in the old code.** The old system used `ORDER BY random()` to
choose *which businesses on a tier get exposure* — a perk handed out arbitrarily, with no way to
say "this one, here." The new system keeps random for the same reason a raffle is fair: everyone
in the pool has been deliberately put there, and over many visitors each gets shown roughly
equally. Assignment is the decision; order is not.

**The consequence, stated plainly:** with more than 3 ads in a position, any given visitor sees
only 3 of them, and there is no way to guarantee a particular ad appears. If a time-sensitive
flyer must be seen by everyone, the only lever is to keep that position's pool at 3 or fewer, or
to give it a position with less competition. This was chosen knowingly over pinning.

`sort_order` is left on the table, unused, rather than dropped — removing a column is
irreversible, and a future "pin this one" is a small change if it is ever wanted. Nothing reads
it, so it cannot drift.

---

## 5. What happens to the existing system

`/api/featured-businesses` and its plan-gated query are **replaced**, not run alongside. Nothing
is lost: 0 of 1,633 businesses have a `banner_image_url`, so it currently returns an empty array
on every homepage render. The tier perk survives — a business on a qualifying plan submits an ad,
and once approved it auto-fills its position.

### The blogger boost is kept

`/api/featured-businesses?include=bloggers` (live in `HomepageBanner.tsx:28`) reserves **1 of the
3 banner slots** for a business whose owner published an approved blog post in the last 30 days,
then shuffles so that slot is not always last.

I initially proposed retiring this, on the grounds that it reshuffles placements behind your back.
That objection only holds if the order is *supposed* to be deliberate. Since selection is random
anyway, a reserved slot is just another way of choosing who is in the pool — it composes cleanly.
**Kept, banner only.**

Ported faithfully: of the three banner picks, one prefers an ad whose business's owner has
published in the last 30 days, if such an ad exists; otherwise all three come from the general
pool. It applies only to ads that *have* a `business_id` — a community flyer has no owner who
could blog.

---

## 6. Rendering

Rotation, pause-on-hover and the prev/next controls already exist in `HomepageBanner` and
`HomepageSidebarAds` at 5s and 6s. That is reuse, not new work. What changes:

- **`object-cover` → `object-contain`.** Both components currently *crop* images to fill the
  slot. Letterboxing was chosen, so a portrait flyer must be shown whole, not cropped to a strip.
- **Data source** switches from `/api/featured-businesses` to the ads query.
- **Sidebars diverge** — each fetches its own placement.
- **Click opens the overlay**, it no longer navigates directly.

### Accessibility

Auto-advancing content is moving content under WCAG 2.2.2 and needs a pause mechanism. Hover-pause
already exists; **focus-within pause is added** (keyboard users cannot hover), matching the fix
already made on the hero dial. Under `prefers-reduced-motion` auto-advance is disabled entirely
and the dots/arrows remain as the manual control — the ads stay reachable, they just do not move
on their own.

### Labels and empty positions

The three existing `Sponsored` captions (`HomepageBanner.tsx:219`,
`HomepageSidebarAds.tsx:206` and `:301`) are **removed**. Ads carry no label. Decided
deliberately, not overlooked: the alternative considered was "Sponsored" for business ads and
"Community" for free flyers. A flyer sitting in an obvious ad slot is not native advertising
dressed as editorial, so nothing is being disguised.

Empty positions keep the existing dashed "Advertise Here" placeholder linking to
`/register-business`, in **all three** positions — the pitch is worth more than the tidier look
of collapsing them.

### The overlay

Thumbnail → full-flyer overlay at natural aspect ratio → a single button at the bottom carrying
the destination. When `link_type` is `none` there is no button; `resolveAdHref` already returns
**null** for that case rather than `"#"`, and callers must handle it.

This is what makes letterboxed portrait artwork acceptable: the strip only has to be recognisable
enough to earn a click, and the overlay does the reading.

---

## 7. The aspect-ratio warning

Client-side in the admin form, once the image loads, from its natural dimensions:

| Position | Slot | Warn when |
|---|---|---|
| `banner` | full width × 128–192px, very wide | ratio < 1.0 (portrait) — "this will letterbox with large empty margins; crop it or use a sidebar" |
| `sidebar-*` | ~288 × 160px | ratio > 2.5 (very wide) — "this will appear as a thin strip in a sidebar" |

**Warnings, not blocks.** A deliberate letterbox is a legitimate choice; the point is that nobody
discovers the problem by looking at the live homepage.

---

## 8. Admin page — `/admin/businesses/ads`

One page, three lists, one per position. Each row: thumbnail, title, advertiser, link target,
schedule, live/scheduled/expired/pending state, click count.

- **Add** — upload, title, position, link type + target, optional dates
- **Approve / reject** — pending submissions, with a reason on reject, same shape as the video review queue
- **Move** — change position; the aspect-ratio warning re-evaluates
- **Toggle** — `is_active` off without deleting

No reordering and no pinning: within a position every ad is equal, so there is nothing to order.

Each list shows a **pool-size note** — "6 ads competing for 3 slots" — because that is the one
thing that silently changes how often an advertiser is seen, and it is invisible otherwise.

State is derived through `liveAdCondition`, the same function the public render uses, so the admin
cannot disagree with the homepage about what is running.

---

## 9. Business submission

On the business dashboard, when the plan grants `show_in_homepage_banner` or
`show_in_homepage_sidebar`: upload artwork, choose "link to my business page" or an external URL,
submit. Lands as `pending`. On approval it joins that position's pool.

Community organisations have no listing and no login, so **the admin uploads their artwork**.
They email it in. Building an advertiser account type was rejected as a lot of machinery for what
is likely a handful of free flyers a year.

Upload uses the existing direct-to-Blob path (`src/lib/upload-client.ts`), not the serverless
route — Vercel's request-body cap is what broke newsletter uploads.

---

## 10. Click tracking

`click_count` increments via `navigator.sendBeacon` on the overlay button, non-blocking, so a slow
write never delays navigation. **Impressions are deliberately not tracked** — that would mean a
database write on every homepage render.

---

## 11. Out of scope

Invoicing, self-serve payment for ad slots, impression counting, A/B rotation weighting,
targeting by page or audience, the "spillover" fourth slot, advertiser accounts for
non-businesses, and pinning an ad to a guaranteed slot.

---

## 12. Migration summary

1. `placement` CHECK → three values; map `sidebar` → `sidebar-left`. That is the only schema
   change — everything else is served by the table as already shipped.
2. Applied to **both** primary and the Neon test branch — a migration applied to only one is how
   every plan-capability test failed with `column "show_shoutouts" does not exist`

```
npx tsx scripts/apply-sql-file.ts migrations/<file>.sql
npx tsx scripts/apply-sql-file.ts migrations/<file>.sql --test
```

---

## 13. Open

Nothing blocking. Worth revisiting once real ads are running:

- **If a position's pool grows past 3–4**, advertisers start being invisible to most visitors and
  pinning (or a bigger rotation) becomes worth reconsidering. The admin pool-size note exists to
  make that visible before anyone complains.
- **The mobile strip merges both sidebars**, so a sidebar ad's exposure on phones depends on the
  combined pool, not its own. Fine at current volumes.
