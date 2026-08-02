# Newsletters: findable by name, managed from one screen

**Date:** 2026-08-02
**Status:** approved after review; not implemented
**Revision:** 2 — a review found the central requirement was missed. Three readers asked *where* to find Israel News, and revision 1 answered with a heading on a page they must already know to visit. There was still no link you could send them. See *Review findings*.

## Problem

Three readers wrote in:

> *"I used to print 'Israel News' and with your designed website I no longer see it. Where can I find it now."*

> *"Where can you get the weekly Israel Newsletter from Bayt."*

Nothing is broken. The feature to host this exists, is linked in the public nav twice, and returns 200. It has **zero rows** — someone built the shelf and nobody stocked it. A reader who used to print Israel News arrives at a page headed "Newsletters" holding six parsha sheets from shuls they may not attend, and concludes it is gone.

Three fixable things sit underneath.

**You cannot link anyone to Israel News.** There is no permalink, no filtered view, and newsletters appear in **no search index** — `src/lib/search/types.ts:1-11` defines nine `SearchType`s and neither `community_newsletters` nor `shul_documents` is among them. So the literal question three people asked — *where can I find it* — has no answerable reply beyond "go to /newsletters and look".

**Readers search by name; the page organises by date.** `publisher` is displayed under each card (`(public)/newsletters/page.tsx:117-118`) but never used to group. "Israel News" is not a heading anywhere, and last week's issue is lost by date rather than one click away.

**Nobody can tell where to upload it.** Four screens are involved and three carry the same word:

| Screen | What it does |
|---|---|
| Sidebar → **Newsletters** | Sends email to the subscriber list |
| Community → **Newsletters** | Community PDFs — feeds the public page |
| Shuls → *a shul* → **Docs** | Shul PDFs — also feeds the public page |
| *(the public `/newsletters` page)* | Where both land |

Two tables (`community_newsletters`, `shul_documents`) managed in two unrelated places feed one public page, so no admin screen answers "what is live right now?". Picking the wrong screen either does nothing or emails the entire community. The existing admin page already carries the note *"This is separate from the email newsletter system"* — written by someone who hit this exact confusion.

## Decisions

| Decision | Choice |
|---|---|
| **Addressability** | **A series gets its own URL** — `/newsletters?publisher=israel-news` — and appears in site search |
| Structure | **Keep both tables.** One admin screen reads across them |
| Admin scope | See everything, edit only what that screen owns |
| Public change | Group by publisher; a named series is browsable |
| Naming | Rename so no two admin items share a word |
| Order | **Addressability first** — it is what the emails literally asked |
| Not doing | Merging tables · notifications · renaming the public page |

**Why not merge the tables.** A shul newsletter belongs to a shul and has its own uploader — `api/shuls/[id]/documents/route.ts:60` runs `canUserManageShul`, so a shul manager can post without an admin. Merging rewires that path and the shul detail page for what is mostly a naming problem. (All 7 rows were in fact uploaded by `admin@frumtoronto.com`, so the capability is designed-for but unexercised — a reason to preserve it carefully, not discard it.)

## 1 · Addressability — the part that answers the emails

**A filtered view.** `/newsletters?publisher=israel-news` shows that series only, with a heading naming it. This is the link you reply to those three readers with. Slugified match so `Israel News` and `israel-news` resolve alike; an unknown publisher renders an empty state offering the full list rather than a 404.

**Search coverage.** Add a `newsletters` `SearchType` spanning both tables — matching `title`, `publisher`, and the shul name for shul newsletters — resolving to the filtered view. Typing "Israel News" into the site search then finds it, which is the behaviour the emails describe wanting.

Without these two, everything below is a nicer page that the people who wrote in still cannot be pointed at.

## 2 · Public page grouping

`(public)/newsletters/page.tsx` already fetches the two sets separately and hides an empty section. The change is inside the community section: group by `publisher`, newest series first.

```
Israel News                                  ← the words readers used
  ┌──────────────────┐
  │ Week of Aug 3    │   latest issue
  └──────────────────┘
  Past issues: Jul 27 · Jul 20 · Jul 13      ← <details>, capped at 12, then "see all"

Shul Newsletters
  … unchanged
```

Rules that are easy to get wrong and so are stated:

- **Collapsing uses `<details>/<summary>`.** The page is an async Server Component with no `"use client"`. `<details>` keeps it one, needs no JavaScript, is keyboard accessible, and leaves the content in the DOM for search engines.
- **"Other"** holds publisher-less newsletters and **always sorts last**, or one ad-hoc PDF pushes Israel News below the fold. If the only group is "Other", render no headings at all — otherwise the near-term state is one heading reading "Other" over everything, which is worse than today.
- **Series order by newest issue**, and within a series `desc(publishedAt), desc(id)`. `published_at` is nullable (`schema.ts:520`), and Postgres sorts NULLs **first** under `desc()`, so an undated newsletter would float above the current week. Use `NULLS LAST`. Every list ordering in this repo carries an id tiebreaker for this reason.
- **Grouping excludes `isActive = false`.** The public query already filters; the grouping module must not reintroduce them.
- **Cap the past-issues list** at 12 per series with a "see all" link to the filtered view, and `.limit()` the query. Both current queries are unbounded `select()` under `force-dynamic` — the exact shape that made `/kosher-alerts` take 46 seconds after the legacy import.

## 3 · A publication date the admin can actually set

**Revision 1's mock was undeliverable.** `publishedAt` exists on the table and in the `orderBy`, but it is **not a form field and not in either API schema** (`api/admin/community-newsletters/route.ts:10-16`, `[id]/route.ts:10-17`). It falls back to `defaultNow()`. Upload a four-issue backlog in one sitting and all four share a minute, ordered by upload — so "Week of Aug 3" cannot be entered and "newest issue" is arbitrary on day one.

Add a date input to the form and `publishedAt` to the POST and PATCH schemas. Read it as a Toronto calendar date via `fromDateTimeInputs`; it is the issue date, not a timestamp.

No schema change and no migration — but a form field and two schema changes, which revision 1 obscured by saying only the former.

## 4 · Admin

### Renames

| Now | Becomes |
|---|---|
| `AdminLayoutClient.tsx:42` — "Newsletters" | **Email Campaigns** |
| `admin/newsletters/page.tsx:133,149` — `<h1>Newsletters</h1>` | **Email Campaigns**, and ":168 New Newsletter" → "New Campaign" |
| `community/layout.tsx:12` — "Newsletters" | unchanged — now genuinely the public page's admin home |
| Shuls → Docs | unchanged — per-shul and correctly scoped |

Renaming only the sidebar leaves an admin clicking "Email Campaigns" and landing on a page headed "Newsletters" — the ambiguity surviving at exactly the moment the expensive mistake is made. `ShulDocuments.tsx:320` keeps a "Newsletters (n)" section header inside the per-shul dialog; that is scoped and stays.

### Community → Newsletters becomes the mirror

1. **Add a newsletter** — existing form, plus the publication date and a publisher `<datalist>`
2. **Community newsletters** — existing list, **plus an active/inactive indicator and a deactivate toggle**
3. **Shul newsletters** — read-only, each showing its shul, linking to `/admin/shuls?docs=<id>`

Block 2's addition matters: `GET /api/admin/community-newsletters` has **no `isActive` filter** and the UI offers only a hard delete, so a deactivated newsletter looks live in the admin and is absent from the public page. A screen whose purpose is "what is live" must not lie about that. `PATCH` already accepts `isActive` — the UI simply never sends it.

Block 3 must filter **`type = 'newsletter'` and `isActive`**. `shul_documents` holds a `tefillah` row today (6 newsletters, 1 tefillah), and the nearest existing precedent — `api/admin/shuls/[id]/documents/route.ts:33-35` — returns *all* types.

**Docs is a dialog, not a route** (`admin/shuls/page.tsx:215`, driven by `setDocsShul`). Linking into it requires the shuls page to read `?docs=<id>` on mount.

## Components

| File | Change |
|---|---|
| `src/lib/newsletters/group-by-publisher.ts` | **New.** Pure grouping, ordering, "Other" placement, slugs. Testable without a database |
| `src/app/(public)/newsletters/page.tsx` | Grouping, `<details>`, `?publisher=` filter, caps and limits |
| `src/lib/search/types.ts`, `fuzzy-search.ts` | **New `newsletters` search type** across both tables |
| `src/components/search/UniversalSearch.tsx` | `TYPE_LABELS` entry, or results render unlabelled |
| `src/app/(admin)/admin/community/newsletters/page.tsx` | Date field, publisher datalist, active indicator + toggle, read-only shul block |
| `src/app/api/admin/community-newsletters/route.ts` + `[id]` | `publishedAt` in both schemas |
| `src/app/api/admin/community-newsletters/shul-list/route.ts` | **New.** Shul newsletters, filtered by type and isActive |
| `src/app/(admin)/admin/shuls/page.tsx` | Read `?docs=<id>` to deep-link the dialog |
| `src/components/admin/AdminLayoutClient.tsx`, `admin/newsletters/page.tsx` | Renames |

The new route sits under `community-newsletters`, **not** `/api/admin/newsletters/` — that directory *is* the email campaign API, and putting it there would recreate this spec's own problem one layer down.

## Testing

Most of this is unit-level against the pure grouping module:

- Two issues sharing a publisher form one series, newest first
- `Israel News` and `Israeli News` are **different** series — pins the fragility the datalist mitigates, so nobody later papers over it with fuzzy matching and merges two real publishers
- A missing publisher lands in "Other"; **"Other" sorts last**; a lone "Other" group renders no headings
- A **null `publishedAt`** sorts last, not first
- Two issues sharing a `publishedAt` order deterministically by id
- Inactive newsletters never appear in a group
- Past issues cap at 12 with a "see all" link

Integration:

- The shul-list route returns newsletters only — **a `tefillah` row exists and must not appear**
- `?publisher=israel-news` returns only that series; an unknown publisher renders the empty state, not a 404
- Search for a publisher name returns the newsletter and resolves to the filtered view

*Not* tested: the public page rendered end-to-end. It is an async Server Component and the integration project is `environment: 'node'` with no RSC harness (`vitest.config.mts:38-40`), so that test cannot be written as such. Coverage comes from the grouping module plus the route tests.

## Deliberately not in scope

- **Merging the tables** — see above
- **Notifying subscribers** of a new bulletin — it has not been posted once
- **Renaming the public page** — "Newsletters" reads fine once a series carries its own name
- **Adding BAYT to the shul directory** — it is absent, which is why this must be a *community* newsletter with BAYT as publisher. Whether BAYT belongs in the directory is a real and separate question
- **Tightening `fileUrl: z.string().url()`** (`community-newsletters/route.ts:13`), which accepts a `data:` URL where the sibling shul route rejects it. Admin-only and rendered in an `<a href>`; worth fixing, not here

## Review findings

Revision 2 followed an adversarial review — 19 claims checked, 1 wrong.

| Finding | Change |
|---|---|
| Newsletters are in no search index; no permalink | **Addressability made the first requirement** — `?publisher=` view plus a search type |
| `publishedAt` is not on the form or in either schema | Added; the mock was undeliverable without it |
| New API route was placed in the email-campaign namespace | Moved under `community-newsletters` |
| `shul_documents` holds a `tefillah` row | Read-only block must filter by type |
| "Docs" is a dialog, not a route | Deep-link support added to Components |
| Renaming only the sidebar leaves the page titled "Newsletters" | Headings renamed too |
| Admin list shows inactive rows as if live | Indicator + deactivate toggle |
| No pagination — the `/kosher-alerts` 46-second shape | Cap and limit |
| Nullable `publishedAt` sorts NULLs first; no id tiebreaker | `NULLS LAST` + tiebreaker |
| "Other" group placement undefined | Sorts last; suppressed when alone |
| Collapsing mechanism unspecified on an RSC | `<details>` |
| **My claim "publisher is stored and never used" was wrong** | It is displayed at `(public)/newsletters/page.tsx:117-118`; corrected to "never used for grouping" |
