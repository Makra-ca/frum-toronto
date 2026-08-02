# Newsletters Findable Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a named newsletter series — "Israel News" — something you can link to, search for, and browse, and make one admin screen show everything that is on the public newsletters page.

**Architecture:** All grouping, ordering and slug logic lives in one pure module with no database access, so the fiddly rules are unit-testable. The public page and the filtered view are the same Server Component reading a query param. Two tables stay separate; a new read-only route lets one admin screen see across both.

**Tech Stack:** Next.js 16 App Router (Server Components), Drizzle ORM, Neon Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-02-newsletters-findable-design.md` — read it first, especially *Addressability*, which is the requirement revision 1 missed.

---

## Before you start

**Read these:**

1. The spec, particularly *Addressability* and *Review findings*
2. `src/app/(public)/newsletters/page.tsx` — the page you are changing, ~130 lines, an async Server Component
3. `src/lib/search/fuzzy-search.ts:474-520` (`searchSimchas`) — the exact template for a new search type
4. `src/lib/datetime.ts` — the header explains why a `date` column and a `timestamp` must never share a formatter

**Environment facts that will otherwise waste your time:**

- Unit tests are pinned to `TZ=UTC` in `vitest.config.mts` because that is what Vercel runs. Leave it.
- The unit project is **DB-free**. `src/lib/db/index.ts` throws without `DATABASE_URL`, so a unit test must not import anything that reaches it. This is why the grouping module takes plain rows rather than querying.
- Integration tests match `tests/*.test.ts` only and need `.env.test`.
- A burst of `NeonDbError: fetch failed` means the Neon test branch suspended — re-run before investigating.
- Run `npx tsc --noEmit` before every commit. Vitest does not typecheck, and a green suite has hidden a type error in this repo before.
- Baseline eslint first (`npx eslint . 2>&1 | tail -2`). It was **49 errors** on 2026-08-02. The rule is "add nothing new", not "reach zero".
- **No migration.** Every column this needs already exists.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/newsletters/group-by-publisher.ts` | **New.** Pure: slugify, group, order, cap. No DB, no React |
| `src/app/(public)/newsletters/page.tsx` | Grouping, `<details>`, `?publisher=` filter, query limits |
| `src/lib/search/types.ts` | Add `"newsletters"` to `SearchType` |
| `src/lib/search/fuzzy-search.ts` | Add `searchNewsletters`, register in `searchAll` |
| `src/app/api/search/suggestions/route.ts` | Register in the type map |
| `src/components/search/UniversalSearch.tsx` | `TYPE_LABELS` entry |
| `src/app/api/admin/community-newsletters/route.ts` + `[id]/route.ts` | `publishedAt` in both schemas |
| `src/app/(admin)/admin/community/newsletters/page.tsx` | Date field, publisher datalist, active toggle, read-only shul block |
| `src/app/api/admin/community-newsletters/shul-list/route.ts` | **New.** Shul newsletters, filtered by type + isActive |
| `src/app/(admin)/admin/shuls/page.tsx` | Read `?docs=<id>` to deep-link the dialog |
| `src/components/admin/AdminLayoutClient.tsx`, `src/app/(admin)/admin/newsletters/page.tsx` | Renames |

---

## Chunk 1: The grouping module

Everything hard is here, and none of it touches a database.

### Task 1.1: Slugify

**Files:** Create `src/lib/newsletters/group-by-publisher.ts`; Test `tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { publisherSlug } from "@/lib/newsletters/group-by-publisher";

describe("publisherSlug", () => {
  it("makes a URL-safe slug from a publisher name", () => {
    expect(publisherSlug("Israel News")).toBe("israel-news");
    expect(publisherSlug("BAYT")).toBe("bayt");
  });

  it("matches regardless of spacing or case, so a link keeps working", () => {
    expect(publisherSlug("  israel   NEWS ")).toBe("israel-news");
  });

  it("gives publisher-less newsletters a stable slug", () => {
    expect(publisherSlug(null)).toBe("other");
    expect(publisherSlug("")).toBe("other");
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

`npx vitest run --project unit tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 3: Implement**

```ts
/** Publisher-less newsletters collect under this slug. */
export const OTHER_SLUG = "other";

export function publisherSlug(publisher: string | null | undefined): string {
  const trimmed = (publisher ?? "").trim().toLowerCase();
  if (!trimmed) return OTHER_SLUG;
  return trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || OTHER_SLUG;
}
```

- [ ] **Step 4: Run — pass. Step 5: Commit.**

### Task 1.2: Grouping and ordering

**Files:** Modify the same two files.

> Six rules, each of which is a real bug if missed. Write all six tests before implementing.

- [ ] **Step 1: Write the failing tests**

```ts
import { groupByPublisher } from "@/lib/newsletters/group-by-publisher";

const row = (o: Partial<Row> & { id: number }) => ({
  publisher: "Israel News", title: "t", fileUrl: "u",
  publishedAt: new Date("2026-08-03"), isActive: true, ...o,
});

it("collects issues of one publisher into a series, newest first", () => {
  const [series] = groupByPublisher([
    row({ id: 1, publishedAt: new Date("2026-07-27") }),
    row({ id: 2, publishedAt: new Date("2026-08-03") }),
  ]);
  expect(series.slug).toBe("israel-news");
  expect(series.latest.id).toBe(2);
  expect(series.past.map((r) => r.id)).toEqual([1]);
});

it("keeps Israel News and Israeli News as separate series", () => {
  // The datalist on the admin form is what prevents this in practice.
  // Pinned so nobody later 'fixes' it with fuzzy matching and merges two
  // genuinely different publishers.
  const groups = groupByPublisher([
    row({ id: 1, publisher: "Israel News" }),
    row({ id: 2, publisher: "Israeli News" }),
  ]);
  expect(groups).toHaveLength(2);
});

it("puts Other last, however recent its newest issue", () => {
  const groups = groupByPublisher([
    row({ id: 1, publisher: null, publishedAt: new Date("2026-08-10") }),
    row({ id: 2, publisher: "Israel News", publishedAt: new Date("2026-08-03") }),
  ]);
  expect(groups.map((g) => g.slug)).toEqual(["israel-news", "other"]);
});

it("sorts an undated newsletter last, not first", () => {
  // Postgres sorts NULLs FIRST under desc(), which would float a dateless
  // newsletter above the current week.
  const [series] = groupByPublisher([
    row({ id: 1, publishedAt: null }),
    row({ id: 2, publishedAt: new Date("2026-08-03") }),
  ]);
  expect(series.latest.id).toBe(2);
});

it("breaks a tie on id, so a bulk upload has a stable order", () => {
  const same = new Date("2026-08-03");
  const [series] = groupByPublisher([
    row({ id: 1, publishedAt: same }),
    row({ id: 2, publishedAt: same }),
  ]);
  expect(series.latest.id).toBe(2);
});

it("excludes inactive newsletters entirely", () => {
  const groups = groupByPublisher([row({ id: 1, isActive: false })]);
  expect(groups).toHaveLength(0);
});

it("caps past issues and reports the overflow", () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    row({ id: i + 1, publishedAt: new Date(2026, 0, i + 1) })
  );
  const [series] = groupByPublisher(rows, { pastLimit: 12 });
  expect(series.past).toHaveLength(12);
  expect(series.hasMore).toBe(true);
});
```

- [ ] **Step 2: Run — expect failures. Step 3: Implement.**

```ts
export interface Row {
  id: number;
  publisher: string | null;
  title: string;
  fileUrl: string;
  publishedAt: Date | null;
  isActive: boolean | null;
}

export interface Series {
  publisher: string;   // display name, from the newest issue
  slug: string;
  latest: Row;
  past: Row[];
  hasMore: boolean;
}

const DEFAULT_PAST_LIMIT = 12;

/** Newest first. Undated sorts last; ties break on id. */
function byNewest(a: Row, b: Row): number {
  const at = a.publishedAt?.getTime() ?? -Infinity;
  const bt = b.publishedAt?.getTime() ?? -Infinity;
  return bt - at || b.id - a.id;
}

export function groupByPublisher(
  rows: Row[],
  opts: { pastLimit?: number } = {}
): Series[] {
  const pastLimit = opts.pastLimit ?? DEFAULT_PAST_LIMIT;

  const bySlug = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.isActive === false) continue;
    const slug = publisherSlug(r.publisher);
    (bySlug.get(slug) ?? bySlug.set(slug, []).get(slug)!).push(r);
  }

  const series: Series[] = [];
  for (const [slug, group] of bySlug) {
    group.sort(byNewest);
    const [latest, ...rest] = group;
    series.push({
      publisher: latest.publisher?.trim() || "Other",
      slug,
      latest,
      past: rest.slice(0, pastLimit),
      hasMore: rest.length > pastLimit,
    });
  }

  // Other always last: one ad-hoc PDF must not push Israel News below the fold.
  return series.sort((a, b) => {
    if (a.slug === OTHER_SLUG) return 1;
    if (b.slug === OTHER_SLUG) return -1;
    return byNewest(a.latest, b.latest);
  });
}
```

- [ ] **Step 4: Run — pass. Step 5: `npx tsc --noEmit`. Step 6: Commit.**

---

## Chunk 2: The public page

### Task 2.1: Render grouped series

**Files:** Modify `src/app/(public)/newsletters/page.tsx`

- [ ] Pass the community rows through `groupByPublisher`, render one block per series: heading, latest card, and past issues inside `<details><summary>Past issues (n)</summary>`.

> **Use `<details>`, not React state.** The page is an async Server Component with no `"use client"`. `<details>` needs no JavaScript, is keyboard accessible, and leaves the links in the DOM for search engines. A React toggle forces the page client-side for nothing.

- [ ] **Suppress headings when the only group is "Other".** Otherwise the realistic near-term state — a few publisher-less PDFs — renders one heading reading "Other" over everything, which is worse than today's flat grid.
- [ ] Add `.limit(200)` to both queries. They are unbounded `select()` under `force-dynamic` — the shape that made `/kosher-alerts` take 46 seconds after the legacy import.
- [ ] Order `desc(publishedAt), desc(id)`; the module re-sorts, but the limit must take the right rows.
- [ ] Verify by hand: `/newsletters` still shows the six shul newsletters unchanged.
- [ ] Commit.

### Task 2.2: The filtered view — the link you send people

**Files:** Modify the same page; Test `tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 1: Write the failing test** for a `selectSeries(series, slug)` helper in the grouping module:

```ts
it("selects one series by slug for the shareable link", () => {
  const groups = groupByPublisher([row({ id: 1 }), row({ id: 2, publisher: "BAYT" })]);
  expect(selectSeries(groups, "israel-news")).toHaveLength(1);
});

it("returns nothing for an unknown publisher, so the page can offer the full list", () => {
  expect(selectSeries([], "made-up")).toEqual([]);
});
```

- [ ] **Steps 2–4:** fail, implement, pass.
- [ ] Read `searchParams.publisher` in the page and filter through `selectSeries`. **An unknown slug renders an empty state with a link to the full list — never a 404**, because this URL will be pasted into emails and outlive a publisher rename.
- [ ] Verify by hand: `/newsletters?publisher=israel-news`.
- [ ] Commit.

---

## Chunk 3: Search

Without this, a reader still has to know the page exists.

### Task 3.1: `searchNewsletters`

**Files:** Modify `src/lib/search/types.ts`, `src/lib/search/fuzzy-search.ts`; Test `tests/newsletter-search.test.ts` (integration — hits the DB)

- [ ] Add `"newsletters"` to `SearchType`.
- [ ] Write `searchNewsletters(query, limit)` modelled on `searchSimchas` (`fuzzy-search.ts:474`). It spans **both** tables — `community_newsletters` (title, publisher) and `shul_documents` (title, plus the shul name via join) — filtered to `type = 'newsletter'` and `isActive`.
- [ ] Every suggestion's `url` is the filtered view: `/newsletters?publisher=<slug>` for a community series, `/newsletters` for a shul newsletter.
- [ ] Tests: a community newsletter is found by **publisher** name; found by **title**; a shul newsletter is found by **shul name**; a **`tefillah` row is never returned**; an inactive row is never returned.
- [ ] Commit.

### Task 3.2: Register it

**Files:** `src/app/api/search/suggestions/route.ts:30`, `src/components/search/UniversalSearch.tsx:52`

- [ ] Add `newsletters: searchNewsletters` to the type map, and include it in `searchAll` (`fuzzy-search.ts:599`).
- [ ] Add a `TYPE_LABELS` entry — **without it the result renders unlabelled**, which is how `blog` shipped broken once before.
- [ ] Verify by hand in the site search box.
- [ ] Commit.

---

## Chunk 4: Admin

### Task 4.1: A publication date the admin can set

**Files:** `src/app/api/admin/community-newsletters/route.ts:10-16`, `[id]/route.ts:10-17`, `src/app/(admin)/admin/community/newsletters/page.tsx`

> `published_at` exists on the table and in the `orderBy` but is **not a form field and not in either schema**, so it falls back to `defaultNow()`. Upload a four-issue backlog in one sitting and all four share a minute, ordered by upload — the past-issues list is wrong on day one.

- [ ] Add `publishedAt: z.string().optional().nullable()` to both schemas.
- [ ] Add a date input to the form. Read it with `fromDateTimeInputs(value, "12:00")` — it is an issue date, not a moment; noon keeps it on the right Toronto day.
- [ ] Integration test: creating with an explicit date stores that date; creating without one still works.
- [ ] Commit.

### Task 4.2: Publisher datalist

**Files:** the admin page; new `GET` returning distinct publishers (or reuse the existing list response)

- [ ] Offer publishers already used as a `<datalist>` on the publisher input.
- [ ] This is the **only** guard against `Israel News` / `Israeli News` splitting an archive. The grouping test pins that they are different series; this makes picking the same one the path of least resistance.
- [ ] Commit.

### Task 4.3: Show what is actually live

**Files:** the admin page; `src/app/api/admin/community-newsletters/route.ts:26-29`

> `GET` has no `isActive` filter and the UI offers only a hard delete, so a deactivated newsletter looks live in the admin and is absent from the public page. A screen whose job is "what is live" must not lie. `PATCH` already accepts `isActive` — the UI never sends it.

- [ ] Add an active/inactive indicator to each row and a deactivate toggle sending `PATCH { isActive }`.
- [ ] Commit.

### Task 4.4: The read-only shul block

**Files:** Create `src/app/api/admin/community-newsletters/shul-list/route.ts`; modify the admin page; Test `tests/newsletter-shul-list.test.ts`

> The route goes under `community-newsletters`, **not** `/api/admin/newsletters/` — that directory *is* the email campaign API, and putting it there recreates this spec's own problem one layer down.

- [ ] **Step 1: Write the failing test.** `shul_documents` holds a **`tefillah` row** (6 newsletters, 1 tefillah). The nearest precedent, `api/admin/shuls/[id]/documents/route.ts:33-35`, returns *all* types — do not copy it.

```ts
it("returns newsletters only — a tefillah must not be listed", async () => {
  const res = await GET(new Request("http://localhost/api/admin/community-newsletters/shul-list") as never);
  const rows = await res.json();
  expect(rows.every((r) => r.type === "newsletter")).toBe(true);
});

it("refuses a caller who is not an admin", async () => { /* expect 401 */ });
```

- [ ] **Steps 2–4:** fail, implement (`eq(type,'newsletter')`, `eq(isActive,true)`, join `shuls` for the name), pass.
- [ ] Render as a read-only block — **no edit or delete controls**, because shul managers own those rows.
- [ ] Commit.

### Task 4.5: Deep-link into a shul's Docs

**Files:** `src/app/(admin)/admin/shuls/page.tsx:215`

> "Docs" is a client-state dialog (`<Dialog open={!!docsShul}>` driven by `setDocsShul`), not a route. Without this the read-only block's link has no target.

- [ ] Read `?docs=<id>` on mount and open the dialog for that shul.
- [ ] Link each read-only row to `/admin/shuls?docs=<shulId>`.
- [ ] Verify by hand.
- [ ] Commit.

### Task 4.6: Renames

**Files:** `src/components/admin/AdminLayoutClient.tsx:42`, `src/app/(admin)/admin/newsletters/page.tsx:133,149,168`

- [ ] Sidebar label → **Email Campaigns**.
- [ ] **Both `<h1>Newsletters</h1>` too**, and ":168 New Newsletter" → "New Campaign". Renaming only the sidebar leaves an admin clicking "Email Campaigns" and landing on a page headed "Newsletters" — the ambiguity surviving at exactly the moment the expensive mistake is made.
- [ ] Active-state matching is on `href`, not `label` (`AdminLayoutClient.tsx:66-68`), so no route changes.
- [ ] `ShulDocuments.tsx:320` keeps its "Newsletters (n)" header — scoped inside a per-shul dialog, deliberately unchanged.
- [ ] Commit.

---

## Definition of done

- [ ] `/newsletters?publisher=israel-news` shows one series; an unknown slug shows an empty state, not a 404
- [ ] Site search for a publisher name returns the newsletter, labelled
- [ ] "Other" sorts last; a lone "Other" group renders no headings
- [ ] An undated newsletter sorts last, not first
- [ ] Inactive newsletters appear nowhere public, and are visibly inactive in the admin
- [ ] The shul block lists no `tefillah`
- [ ] An admin can set the publication date
- [ ] `npx tsc --noEmit` clean; eslint adds nothing beyond the recorded baseline
- [ ] The six shul newsletters still render exactly as they do today

## Not in scope

Merging the tables · notifying subscribers · renaming the public page · adding BAYT to the shul directory · tightening `fileUrl: z.string().url()` (accepts a `data:` URL where the sibling shul route rejects it — real, but not this).
