# Newsletters Findable Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any newsletter series — "Israel News", or a shul's own — something you can link to, search for, and browse, and make one admin screen show everything that is on the public newsletters page.

**Architecture:** All grouping, ordering and slug logic lives in one pure module with no database access, so the fiddly rules are unit-testable. That module is **generic over the grouping key** — publisher for community newsletters, shul for shul newsletters — because both sides have the same findability problem and one implementation should answer both. The public page and both filtered views are the same Server Component reading a query param. Two tables stay separate; a new read-only route lets one admin screen see across both.

**Tech Stack:** Next.js 16 App Router (Server Components), Drizzle ORM, Neon Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-02-newsletters-findable-design.md` — read it first, especially *Addressability*, which is the requirement revision 1 missed.

---

## Before you start

**Read these:**

1. The spec, particularly *Addressability* and *Review findings*
2. `src/app/(public)/newsletters/page.tsx` — the page you are changing, 191 lines, an async Server Component
3. `src/lib/search/fuzzy-search.ts:474-529` (`searchSimchas`) — read to the end; the `results.map(...)` at the bottom is the actual template for a `SearchSuggestion` — the exact template for a new search type
4. `src/lib/datetime.ts` — the header explains why a `date` column and a `timestamp` must never share a formatter

**Environment facts that will otherwise waste your time:**

- Unit tests are pinned to `TZ=UTC` in `vitest.config.mts` because that is what Vercel runs. Leave it.
- The unit project is **DB-free**. `src/lib/db/index.ts` throws without `DATABASE_URL`, so a unit test must not import anything that reaches it. This is why the grouping module takes plain rows rather than querying.
- Integration tests match `tests/*.test.ts` only and need `.env.test`.
- A burst of `NeonDbError: fetch failed` means the Neon test branch suspended — re-run before investigating.
- Run `npx tsc --noEmit` before every commit. Vitest does not typecheck, and a green suite has hidden a type error in this repo before.
- Baseline eslint first (`npx eslint . 2>&1 | tail -2`). It was **49 errors** on 2026-08-02. The rule is "add nothing new", not "reach zero".
- **No migration for columns** — every one already exists. **But every previous search type shipped a trigram index** (`2026-07-30-simchas-search-indexes.sql` and siblings) because `searchSimchas`, the template, leans on `similarity()`. Skipped here deliberately: 0 community rows and 7 shul documents. Add one the moment either table is non-trivial, and remember the ops rule — apply to **primary and `--test`**, or every integration test fails on a missing object.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/newsletters/group-series.ts` | **New.** Pure: slugify, group by any key, order, cap. No DB, no React |
| `src/app/(public)/newsletters/page.tsx` | Grouping (both sides), `<details>`, `?publisher=` and `?shul=` filters, query limits |
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

**Files:** Create `src/lib/newsletters/group-series.ts`; Test `tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { seriesSlug } from "@/lib/newsletters/group-series";

describe("seriesSlug", () => {
  it("makes a URL-safe slug from a publisher name", () => {
    expect(seriesSlug("Israel News")).toBe("israel-news");
    expect(seriesSlug("Clanton Park Synagogue")).toBe("clanton-park-synagogue");
  });

  it("matches regardless of spacing or case, so a link keeps working", () => {
    expect(seriesSlug("  israel   NEWS ")).toBe("israel-news");
  });

  it("gives newsletters with no key a stable slug", () => {
    expect(seriesSlug(null)).toBe("other");
    expect(seriesSlug("")).toBe("other");
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

`npx vitest run --project unit tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 3: Implement**

```ts
/** Newsletters with no grouping key collect under this slug. */
export const OTHER_SLUG = "other";

/** Shared by publisher names and shul names — the same rules apply to both. */
export function seriesSlug(key: string | null | undefined): string {
  const trimmed = (key ?? "").trim().toLowerCase();
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
// Import everything the block uses, or Step 2 fails on module resolution
// rather than on the logic, and you learn nothing.
import { groupSeries, byPublisher, byShul, selectSeries, type Row } from "@/lib/newsletters/group-series";

const row = (o: Partial<Row> & { id: number }) => ({
  publisher: "Israel News", title: "t", fileUrl: "u",
  publishedAt: new Date("2026-08-03"), isActive: true, ...o,
});

it("collects issues of one publisher into a series, newest first", () => {
  const [series] = groupSeries([
    row({ id: 1, publishedAt: new Date("2026-07-27") }),
    row({ id: 2, publishedAt: new Date("2026-08-03") }),
  ], byPublisher);
  expect(series.slug).toBe("israel-news");
  expect(series.latest.id).toBe(2);
  expect(series.past.map((r) => r.id)).toEqual([1]);
});

it("keeps Israel News and Israeli News as separate series", () => {
  // The datalist on the admin form is what prevents this in practice.
  // Pinned so nobody later 'fixes' it with fuzzy matching and merges two
  // genuinely different publishers.
  const groups = groupSeries([
    row({ id: 1, publisher: "Israel News" }),
    row({ id: 2, publisher: "Israeli News" }),
  ], byPublisher);
  expect(groups).toHaveLength(2);
});

it("puts Other last, however recent its newest issue", () => {
  const groups = groupSeries([
    row({ id: 1, publisher: null, publishedAt: new Date("2026-08-10") }),
    row({ id: 2, publisher: "Israel News", publishedAt: new Date("2026-08-03") }),
  ], byPublisher);
  expect(groups.map((g) => g.slug)).toEqual(["israel-news", "other"]);
});

it("sorts an undated newsletter last, not first", () => {
  // Postgres sorts NULLs FIRST under desc(), which would float a dateless
  // newsletter above the current week.
  const [series] = groupSeries([
    row({ id: 1, publishedAt: null }),
    row({ id: 2, publishedAt: new Date("2026-08-03") }),
  ], byPublisher);
  expect(series.latest.id).toBe(2);
});

it("breaks a tie on id, so a bulk upload has a stable order", () => {
  const same = new Date("2026-08-03");
  const [series] = groupSeries([
    row({ id: 1, publishedAt: same }),
    row({ id: 2, publishedAt: same }),
  ], byPublisher);
  expect(series.latest.id).toBe(2);
});

it("excludes inactive newsletters entirely", () => {
  const groups = groupSeries([row({ id: 1, isActive: false })], byPublisher);
  expect(groups).toHaveLength(0);
});

it("groups shul newsletters by shul with the same rules", () => {
  // The whole reason the module takes a key function: a reader hunting their
  // own shul's newsletter has exactly the problem the Israel News emails
  // describe — six cards titled "Devarim" with the shul in small print.
  const groups = groupSeries(
    [
      { id: 1, title: "Devarim", fileUrl: "u", publishedAt: new Date("2026-07-17"), isActive: true, shulName: "Ahavat Shalom" },
      { id: 2, title: "Devarim", fileUrl: "u", publishedAt: new Date("2026-07-17"), isActive: true, shulName: "Bnai Torah Congregation" },
    ],
    byShul
  );
  expect(groups.map((g) => g.slug).sort()).toEqual([
    "ahavat-shalom",
    "bnai-torah-congregation",
  ]);
});

it("caps past issues and reports the overflow", () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    row({ id: i + 1, publishedAt: new Date(2026, 0, i + 1) })
  );
  const [series] = groupSeries(rows, byPublisher, { pastLimit: 12 });
  expect(series.past).toHaveLength(12);
  expect(series.hasMore).toBe(true);
});
```

- [ ] **Step 2: Run — expect failures. Step 3: Implement.**

```ts
export interface Row {
  id: number;
  title: string;
  fileUrl: string;
  publishedAt: Date | null;
  isActive: boolean | null;
  /** Community newsletters group on this. */
  publisher?: string | null;
  /** Shul newsletters group on this. */
  shulName?: string | null;
}

/** What a row is grouped by. Community newsletters use publisher, shul
 *  newsletters use the shul name — same rules, different key. */
export type SeriesKey = (row: Row) => string | null | undefined;

export const byPublisher: SeriesKey = (r) => r.publisher;
export const byShul: SeriesKey = (r) => r.shulName;

export interface Series {
  name: string;        // display name, from the newest issue
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

export function groupSeries(
  rows: Row[],
  keyOf: SeriesKey,
  opts: { pastLimit?: number } = {}
): Series[] {
  const pastLimit = opts.pastLimit ?? DEFAULT_PAST_LIMIT;

  const bySlug = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.isActive === false) continue;
    const slug = seriesSlug(keyOf(r));
    (bySlug.get(slug) ?? bySlug.set(slug, []).get(slug)!).push(r);
  }

  const series: Series[] = [];
  for (const [slug, group] of bySlug) {
    group.sort(byNewest);
    const [latest, ...rest] = group;
    series.push({
      name: (keyOf(latest) ?? "").trim() || "Other",
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

- [ ] Pass community rows through `groupSeries(rows, byPublisher)` **and shul rows through `groupSeries(rows, byShul)`**, rendering one block per series: heading, latest card, past issues inside `<details><summary>Past issues (n)</summary>`.
- [ ] **Add `isActive: shulDocuments.isActive` to the shul select.** It selects `shulName` already, but filters `isActive` in the `WHERE` and never selects the column — so `groupSeries(shulRows, byShul)` is a **type error today**:
  ```
  error TS2345: Property 'isActive' is missing ... but required in type 'Row'
  ```
  The community side compiles only because it uses bare `select()`, which returns every column.

> **Use `<details>`, not React state.** The page is an async Server Component with no `"use client"`. `<details>` needs no JavaScript, is keyboard accessible, and leaves the links in the DOM for search engines. A React toggle forces the page client-side for nothing.

- [ ] Series headings nest **under** the existing `<h2>Community Newsletters</h2>` (`:97`) and `<h2>Shul Newsletters</h2>` (`:143`) — use `<h3>`, so the document outline stays sane.
- [ ] **Suppress headings when the only group is "Other".** Otherwise the realistic near-term state — a few publisher-less PDFs — renders one heading reading "Other" over everything, which is worse than today's flat grid.
- [ ] Add `.limit(200)` to both queries. They are unbounded `select()` under `force-dynamic` — the shape that made `/kosher-alerts` take 46 seconds after the legacy import.
- [ ] Order `desc(publishedAt), desc(id)`. Drizzle's `desc()` emits no `NULLS LAST` and Postgres sorts NULLs first — safe here **only** because the module re-sorts and the limit is 200, so an undated row cannot displace a real one out of the window. If the limit ever tightens, add `NULLS LAST`.
- [ ] **Render the "see all" link** when `series.hasMore`, pointing at the filtered view. The cap is pointless without it — the older issues become unreachable.
- [ ] Verify by hand: `/newsletters` still shows the six shul newsletters unchanged.
- [ ] Commit.

### Task 2.2: The filtered view — the link you send people

**Files:** Modify the same page; Test `tests/unit/newsletter-grouping.test.ts`

- [ ] **Step 1: Write the failing test** for a `selectSeries(series, slug)` helper in the grouping module:

```ts
it("selects one series by slug for the shareable link", () => {
  const groups = groupSeries([row({ id: 1 }), row({ id: 2, publisher: "BAYT" })], byPublisher);
  expect(selectSeries(groups, "israel-news")).toHaveLength(1);
});

it("returns nothing for an unknown publisher, so the page can offer the full list", () => {
  expect(selectSeries([], "made-up")).toEqual([]);
});
```

- [ ] **Steps 2–4:** fail, implement, pass.

```ts
/** One series by slug, for the shareable link. Empty array = unknown slug,
 *  which the page renders as an empty state rather than a 404. */
export function selectSeries(series: Series[], slug: string | undefined): Series[] {
  if (!slug) return series;
  return series.filter((s) => s.slug === seriesSlug(slug));
}
```
*(Run the slug through `seriesSlug` again so `?publisher=Israel%20News` resolves the same as `?publisher=israel-news`.)*
- [ ] **Take `searchParams` as a prop and `await` it.** The page takes no props today, and in Next 16 `searchParams` is a `Promise` — reading `.publisher` off it yields `undefined`, the filter silently never applies, and **every manual check below then passes by accident**, because an unfiltered page looks correct while only one series exists. Mirror `(public)/simchas/page.tsx:128-132`:
  ```ts
  export default async function NewslettersPage({ searchParams }: {
    searchParams: Promise<{ publisher?: string; shul?: string }>;
  }) {
    const { publisher, shul } = await searchParams;
  ```
- [ ] Filter the matching side through `selectSeries`. `?publisher=` shows **that series only** — the shul section is hidden entirely, not left full. Otherwise the link you send the three readers renders Israel News *plus all six parsha sheets*, which is close to the state they complained about. `?shul=` does the mirror. **An unknown slug renders an empty state with a link to the full list — never a 404**, because these URLs will be pasted into emails and outlive a rename.
- [ ] Verify by hand: `/newsletters?publisher=israel-news` and `/newsletters?shul=clanton-park-synagogue`.
- [ ] Commit.

---

## Chunk 3: Search

Without this, a reader still has to know the page exists.

### Task 3.1: `searchNewsletters`

**Files:** Modify `src/lib/search/types.ts`, `src/lib/search/fuzzy-search.ts`; Test `tests/newsletter-search.test.ts` (integration — hits the DB)

- [ ] Add `"newsletters"` to `SearchType`.
- [ ] Write `searchNewsletters(query, limit)` modelled on `searchSimchas` (`fuzzy-search.ts:474`). It spans **both** tables — `community_newsletters` (title, publisher) and `shul_documents` (title, plus the shul name via join) — filtered to `type = 'newsletter'` and `isActive`.
- [ ] Every suggestion's `url` is a filtered view: `/newsletters?publisher=<slug>` for a community series, **`/newsletters?shul=<slug>`** for a shul newsletter. Neither resolves to the bare page — the point is landing on the series.
- [ ] **Both slugs come from `seriesSlug(name)` — never from `shuls.slug`.** The grouping derives its key from the shul *name*, so a search result built on the existing `shuls.slug` column (which is right there in the query and the obvious thing to reach for) would land on an empty state every time.
- [ ] **Prefix the suggestion id per table** — `c-${id}` / `s-${id}`. Both tables have `serial` PKs starting at 1, and the id is rendered into a React key as `` `${type}-${id}` `` (`UniversalSearch.tsx:330`), so community #3 and shul-doc #3 in one result set collide.
- [ ] Tests: a community newsletter is found by **publisher** name; found by **title**; a shul newsletter is found by **shul name**; a **`tefillah` row is never returned**; an inactive row is never returned.
- [ ] Commit.

### Task 3.2: Register it

**Files:** `src/app/api/search/suggestions/route.ts:30`, `src/components/search/UniversalSearch.tsx:52`

- [ ] Add `newsletters: searchNewsletters` to the type map, and include it in `searchAll` (`fuzzy-search.ts:585`).
- [ ] Add a `TYPE_LABELS` entry in `UniversalSearch.tsx:52`.
- [ ] **And a `typeConfig` entry in `(public)/search/page.tsx:21`** — a second, separate map that falls back to `typeConfig.businesses` (`:117`), so a missing entry renders a newsletter as **"Business" with a building icon** rather than merely unlabelled. `blog`, `simchas` and `kosher-alerts` are mislabelled this way in production right now, which is the evidence this omission recurs.
- [ ] Verify by hand in the site search box.
- [ ] Commit.

---

## Chunk 4: Admin

### Task 4.1: A publication date the admin can set

**Files:** `src/app/api/admin/community-newsletters/route.ts:10-16`, `[id]/route.ts:10-17`, `src/app/(admin)/admin/community/newsletters/page.tsx`

> `published_at` exists on the table and in the `orderBy` but is **not a form field and not in either schema**, so it falls back to `defaultNow()`. Upload a four-issue backlog in one sitting and all four share a minute, ordered by upload — the past-issues list is wrong on day one.

- [ ] Add `publishedAt: z.string().optional().nullable()` to both schemas.
- [ ] **Write it into both the POST `.values({...})` (`route.ts:53-60`) and the PATCH `updates` object (`[id]/route.ts:41-47`).** A schema field alone is validated and then dropped — the column keeps its `defaultNow()`.
- [ ] **Convert to a `Date`, and guard the empty string.** `fromDateTimeInputs` returns an **ISO string** (`datetime.ts:168-192`), but the column is `timestamp()` with no `mode: "string"`, so Drizzle demands a `Date`. And `fromDateTimeInputs("")` returns `""`, which `z.string().optional()` happily accepts and `new Date("")` turns into an Invalid Date — an insert error every time the admin leaves the field blank:
  ```ts
  publishedAt: result.data.publishedAt ? new Date(result.data.publishedAt) : undefined,
  ```
- [ ] Add a date input to the form. Read it with `fromDateTimeInputs(value, "12:00")` — an issue date, not a moment; noon keeps it on the right Toronto day.
- [ ] Integration tests: an explicit date is stored; **an explicitly empty `publishedAt: ""` still succeeds** (send the key, do not omit it — omitting tests a different path); omitting it falls back to now.
- [ ] Commit.

### Task 4.2: Publisher datalist

**Files:** `src/app/(admin)/admin/community/newsletters/page.tsx` only

- [ ] Offer publishers already used as a `<datalist>`, derived **client-side** from the list the page already fetches (`[...new Set(rows.map(r => r.publisher))]`). No new route — the data is on the page.
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

> As first drafted this test **passed against everything**. Two reasons, both of which this repo has shipped before: without a hoisted `auth` mock the route 401s before touching the database, so `rows` is `{ error }` and `.every` is not a function — a `TypeError` that says nothing about tefillah; and with no fixture, `[].every(...)` is `true`, so a route returning *nothing* passes too.

```ts
const mocks = vi.hoisted(() => ({ session: { user: { id: "1", role: "admin" } } }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
const { GET } = await import("@/app/api/admin/community-newsletters/shul-list/route");

// beforeAll inserts BOTH a type:'newsletter' and a type:'tefillah' row, ids recorded.

it("returns newsletters only — a tefillah must not be listed", async () => {
  const res = await GET(new Request("http://localhost/x") as never);
  expect(res.status).toBe(200);                       // proves auth let us through
  const rows = await res.json();
  expect(rows.map((r) => r.id)).toContain(newsletterId);   // positive control
  expect(rows.map((r) => r.id)).not.toContain(tefillahId); // the actual assertion
});

it("refuses a caller who is not an admin", async () => { /* 401 */ });
```

- [ ] **Steps 2–4:** fail, implement (`eq(type,'newsletter')`, `eq(isActive,true)`, join `shuls` for the name), pass.
- [ ] Render as a read-only block — **no edit or delete controls**, because shul managers own those rows.
- [ ] Commit.

### Task 4.5: Deep-link into a shul's Docs

**Files:** `src/app/(admin)/admin/shuls/page.tsx:215`

> "Docs" is a client-state dialog (`<Dialog open={!!docsShul}>` driven by `setDocsShul`), not a route. Without this the read-only block's link has no target.

- [ ] **The effect must depend on the loaded shul list, not run on mount.** `docsShul` holds a whole `Shul` object (`:36`, read at `:219` and `:222`), and the list arrives from an async fetch in a separate effect (`:38-55`). On mount `shuls` is `[]`, so a mount-time lookup finds nothing and the dialog silently never opens.
- [ ] **Wrap in `<Suspense>`.** The page is `"use client"` with no `useSearchParams` today; adding one without a boundary breaks the build. `(public)/search/page.tsx:3,185-187` is the precedent this repo already had to add.
- [ ] Link each read-only row to `/admin/shuls?docs=<shulId>`.
- [ ] Verify by hand.
- [ ] Commit.

### Task 4.6: Renames

**Files:** `src/components/admin/AdminLayoutClient.tsx:42`, `src/app/(admin)/admin/newsletters/page.tsx:133,149,168`

- [ ] Sidebar label → **Email Campaigns**.
- [ ] **Both `<h1>Newsletters</h1>` too**, and ":168 New Newsletter" → "New Campaign". Renaming only the sidebar leaves an admin clicking "Email Campaigns" and landing on a page headed "Newsletters" — the ambiguity surviving at exactly the moment the expensive mistake is made.
- [ ] Active-state matching is on `href`, not `label` (`AdminLayoutClient.tsx:67-69`), so no route changes.
- [ ] `ShulDocuments.tsx:320` keeps its "Newsletters (n)" header — scoped inside a per-shul dialog, deliberately unchanged.
- [ ] Commit.

---

## Definition of done

- [ ] `/newsletters?publisher=israel-news` shows one series; an unknown slug shows an empty state, not a 404
- [ ] `/newsletters?shul=clanton-park-synagogue` does the same for a shul, and a shul can link members straight to it
- [ ] Site search for a publisher name returns the newsletter, labelled
- [ ] "Other" sorts last; a lone "Other" group renders no headings
- [ ] An undated newsletter sorts last, not first
- [ ] Inactive newsletters appear nowhere public, and are visibly inactive in the admin
- [ ] The shul block lists no `tefillah`
- [ ] An admin can set the publication date
- [ ] A filtered view hides the *other* section, not just narrows its own
- [ ] Search results resolve to a series, are labelled on **both** result surfaces, and ids do not collide across the two tables
- [ ] Leaving the publication date blank does not error
- [ ] `npx tsc --noEmit` clean; eslint adds nothing beyond the recorded baseline
- [ ] The six shul newsletters still render, now grouped under their shul

## Not in scope

Merging the tables · notifying subscribers · renaming the public page · adding BAYT to the shul directory · tightening `fileUrl: z.string().url()` (accepts a `data:` URL where the sibling shul route rejects it — real, but not this).
