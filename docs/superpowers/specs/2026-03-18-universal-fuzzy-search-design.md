# Universal Fuzzy Search Component

**Date:** 2026-03-18
**Status:** Approved

## Overview

Replace all search implementations across the site with a single reusable `<UniversalSearch />` component backed by one unified API endpoint. Every search bar gets fuzzy matching via PostgreSQL `pg_trgm`, a live dropdown with suggestions, keyboard navigation, and highlighted matches.

## Current State

| Page | Search Type | Fuzzy? | Dropdown? | Implementation |
|------|------------|--------|-----------|----------------|
| Ask the Rabbi | `AskTheRabbiSearch.tsx` → `/api/ask-the-rabbi/search` | Yes | Yes | Standalone |
| Homepage hero | Inline in `HeroSection.tsx` → `/api/search` | Yes | Yes | Standalone |
| Directory | `DirectorySearch.tsx` → server-side ILIKE | No | No | Basic |
| Classifieds | `ClassifiedsBrowser.tsx` → server-side ILIKE | No | No | Basic |
| Shuls | No search | - | - | None |
| Shiurim | No search | - | - | None |
| Calendar | No search | - | - | None |

## Target State

All pages use `<UniversalSearch searchType="..." />` hitting `/api/search/suggestions?type=...&q=...`.

## Shared Component: `<UniversalSearch />`

**Location:** `src/components/search/UniversalSearch.tsx`

### Props

```typescript
interface UniversalSearchProps {
  searchType: "businesses" | "classifieds" | "shuls" | "shiurim" | "events" | "ask-the-rabbi" | "all";
  placeholder?: string;
  onSearch?: (query: string) => void;  // Fires on Enter — parent filters its list
  className?: string;
  minChars?: number;  // Default: 2 (3 for type="all")
  maxSuggestions?: number;  // Default: 8
}
```

### Behavior

- **Debounce:** 300ms after typing stops
- **Min chars:** 2 before triggering API call (3 for `type="all"` to reduce noise on multi-table queries)
- **Dropdown:** Shows up to 8 fuzzy-matched suggestions
- **Highlighting:** Query terms highlighted in yellow in suggestion text
- **Keyboard:** Arrow Up/Down to navigate, Enter to select/search, Escape to close
- **Click suggestion:** Navigate to detail page via `router.push()`
- **Press Enter (no suggestion selected):** Calls `onSearch(query)` so parent page filters its list
- **Click outside:** Closes dropdown
- **Loading state:** Subtle spinner while fetching
- **Empty state:** "No results found" message
- **AbortController:** Each new request cancels the previous in-flight request to prevent stale results from appearing

### Suggestion Item Shape

```typescript
interface SearchSuggestion {
  id: string;            // Stringified ID (converted from number in API)
  title: string;          // Primary text (name, title)
  subtitle?: string;      // Secondary text (see Subtitle Format below)
  url: string;            // Detail page URL
  type: string;           // Content type label for "all" mode
  relevanceScore: number; // For sorting
}
```

### Subtitle Format Per Type

| Type | Subtitle Format | Example |
|------|----------------|---------|
| Businesses | Category name | "Restaurants" |
| Classifieds | Category name | "Electronics" |
| Shuls | Denomination + rabbi | "Orthodox - Rabbi Cohen" |
| Shiurim | Teacher name + category | "Rabbi Goldberg - Gemara" |
| Events | Event date + event type | "Mar 25, 2026 - Community Event" |
| Ask the Rabbi | Question number | "#142" |

## Unified API Endpoint

**Route:** `/api/search/suggestions`

**Method:** GET

**Query Params:**
- `q` (required) — search query string
- `type` (required) — content type to search
- `limit` (optional, default 8) — max results

### Search Fields Per Type

| Type | Fields | Join Required | Detail URL Pattern |
|------|--------|---------------|--------------------|
| `businesses` | name, description, category name | LEFT JOIN `businessCategories` | `/directory/business/[slug]` |
| `classifieds` | title, description | None | `/classifieds/[id]` |
| `shuls` | name, rabbi, address | None | `/shuls/[slug]` |
| `shiurim` | title, teacherName, projectOf | None | `/shiurim/[id]` |
| `events` | title, location | None | `/community/calendar/[id]` |
| `ask-the-rabbi` | title, question | None | `/ask-the-rabbi/[id]` |
| `all` | All of the above combined | See individual types | Respective detail pages |

**Note:** `teacherName` is the combined name field on shiurim. `projectOf` is the sponsoring organization field. Event description is NOT fuzzy-searched (only ILIKE) to avoid expensive trigram indexes on long text fields — fuzzy matching is on `title` only.

### Required WHERE Conditions Per Type

Every query MUST include these visibility filters to prevent exposing unpublished/inactive content:

| Type | Required WHERE Conditions |
|------|--------------------------|
| `businesses` | `approvalStatus = 'approved'` AND `isActive = true` |
| `classifieds` | `approvalStatus = 'approved'` AND `isActive = true` |
| `shuls` | `isActive = true` |
| `shiurim` | `isActive = true` AND `approvalStatus = 'approved'` |
| `events` | `isActive = true` AND `startTime >= now()` |
| `ask-the-rabbi` | `isPublished = true` |

### Fuzzy Matching Logic

Uses PostgreSQL `pg_trgm` extension (already enabled) with `word_similarity()` function.

**Scoring (per result):**

| Criteria | Score |
|----------|-------|
| Primary field exact match (case-insensitive) | +150 |
| Primary field starts with query | +120 |
| Primary field contains query (ILIKE) | +100 |
| Secondary field contains query | +50 |
| `word_similarity()` on primary field (0-1 scale x 80) | +0-80 |
| `word_similarity()` on secondary field (0-1 scale x 40) | +0-40 |

**Thresholds:** `word_similarity > 0.3` minimum to appear in results.

**Multi-word queries:** Split into words, each word must match at least one field (exact ILIKE OR fuzzy above threshold). Scores are summed across all matching words. This prevents irrelevant results on multi-word searches while giving higher scores to results that match more words strongly.

### Response Shape

```json
{
  "suggestions": [
    {
      "id": "123",
      "title": "Beth Jacob Synagogue",
      "subtitle": "Orthodox - Rabbi Cohen",
      "url": "/shuls/beth-jacob-synagogue",
      "type": "shul",
      "relevanceScore": 245
    }
  ]
}
```

### `type=all` Behavior

When `type=all`, the endpoint runs all 6 type queries in parallel via `Promise.all()`, each limited to 3 results. Results are merged and sorted by relevanceScore, then trimmed to the top 8. This keeps each individual query fast while providing diverse results across content types.

## Database: New Trigram Indexes

Script: `scripts/enable-universal-search-indexes.ts`

```sql
-- Shuls
CREATE INDEX IF NOT EXISTS idx_shuls_name_trgm ON shuls USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shuls_rabbi_trgm ON shuls USING GIN (rabbi gin_trgm_ops);

-- Shiurim
CREATE INDEX IF NOT EXISTS idx_shiurim_title_trgm ON shiurim USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shiurim_teacher_trgm ON shiurim USING GIN ("teacherName" gin_trgm_ops);

-- Events (title only — no description index, too expensive on long text)
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops);

-- Businesses
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_description_trgm ON businesses USING GIN (description gin_trgm_ops);

-- Classifieds
CREATE INDEX IF NOT EXISTS idx_classifieds_title_trgm ON classifieds USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_classifieds_description_trgm ON classifieds USING GIN (description gin_trgm_ops);
```

(Ask the Rabbi indexes already exist.)

## Page Integration Plan

### New Search Bars (pages that currently have none)

**Shuls (`/shuls`):**
- Add `<UniversalSearch searchType="shuls" />` above the denomination/nusach filter row
- `onSearch` filters the shuls list client-side or re-fetches with query param

**Shiurim (`/shiurim`):**
- Add `<UniversalSearch searchType="shiurim" />` above the existing filter row
- `onSearch` filters the shiurim list

**Calendar (`/community/calendar`):**
- Add `<UniversalSearch searchType="events" />` above the event type filter checkboxes
- `onSearch` filters visible events

### Upgraded Search Bars (pages with existing basic search)

**Directory (`/directory`):**
- Replace `DirectorySearch.tsx` usage with `<UniversalSearch searchType="businesses" />`
- Keep existing filters (city, category, sort) alongside
- `onSearch` navigates to `/directory/search?q=...` (existing behavior)
- Note: `DirectorySearch.tsx` also exports `CompactDirectorySearch` — check all usages and migrate before removing

**Classifieds (`/classifieds`):**
- Replace inline search input in `ClassifiedsBrowser.tsx` with `<UniversalSearch searchType="classifieds" />`
- Keep existing category filter alongside
- `onSearch` updates query param and re-fetches

### Refactored Search Bars (pages with existing fuzzy search)

**Ask the Rabbi (`/ask-the-rabbi`):**
- Replace `AskTheRabbiSearch.tsx` with `<UniversalSearch searchType="ask-the-rabbi" />`
- `onSearch` navigates to `/ask-the-rabbi?q=...` (existing behavior)
- Remove standalone `/api/ask-the-rabbi/search` endpoint (consolidated into unified endpoint)

**Homepage hero:**
- Replace inline search in `HeroSection.tsx` with `<UniversalSearch searchType="all" />`
- `onSearch` navigates to `/search?q=...` (existing behavior)
- **ATOMIC CHANGE:** The old `/api/search` endpoint and the HeroSection refactor must happen together. Do not remove the old endpoint before the component is updated.

**`/search` results page:**
- Update to use the new `/api/search/suggestions` endpoint with `type=all`
- Adjust to read from `data.suggestions` instead of `data.results`

## Filtering Behavior

Each page that has existing filters keeps them. The search text works as an AND condition with filters:

```
results = items WHERE (matches fuzzy search) AND (matches selected filters)
```

For pages where filtering happens server-side (directory, classifieds), the search query is sent as a URL param alongside filter params. For pages where filtering happens client-side (shuls, shiurim, calendar), the `onSearch` callback triggers a re-fetch or client-side filter.

## Files Created

| File | Purpose |
|------|---------|
| `src/components/search/UniversalSearch.tsx` | Shared search component |
| `src/app/api/search/suggestions/route.ts` | Unified suggestions API |
| `src/lib/search/fuzzy-search.ts` | Shared fuzzy query builder helpers |
| `scripts/enable-universal-search-indexes.ts` | Trigram index creation |

## Files Modified

| File | Change |
|------|--------|
| `src/components/home/HeroSection.tsx` | Replace inline search with `<UniversalSearch searchType="all" />` |
| `src/app/ask-the-rabbi/page.tsx` | Replace `AskTheRabbiSearch` with `<UniversalSearch searchType="ask-the-rabbi" />` |
| `src/app/(public)/shuls/page.tsx` | Add `<UniversalSearch searchType="shuls" />` |
| `src/app/(public)/shiurim/page.tsx` | Add `<UniversalSearch searchType="shiurim" />` |
| `src/app/(public)/community/calendar/page.tsx` | Add `<UniversalSearch searchType="events" />` |
| `src/app/directory/search/page.tsx` | Use `<UniversalSearch searchType="businesses" />` |
| `src/components/classifieds/ClassifiedsBrowser.tsx` | Use `<UniversalSearch searchType="classifieds" />` |
| `src/app/search/page.tsx` (or wherever `/search` lives) | Update to use new suggestions API |

## Files Removed (after migration)

| File | Reason |
|------|--------|
| `src/components/ask-the-rabbi/AskTheRabbiSearch.tsx` | Replaced by UniversalSearch |
| `src/components/directory/DirectorySearch.tsx` | Replaced by UniversalSearch (verify CompactDirectorySearch usages first) |
| `src/app/api/ask-the-rabbi/search/route.ts` | Consolidated into suggestions API |
| `src/app/api/search/route.ts` | Consolidated into suggestions API |

## Error Handling

- API returns empty suggestions array on error (no crash)
- Component shows "No results found" for empty results
- Network errors silently fail (dropdown just doesn't appear)
- If `pg_trgm` functions unavailable, falls back to ILIKE-only matching

## Performance

- 300ms debounce prevents excessive API calls
- AbortController cancels stale requests
- Trigram GIN indexes make fuzzy queries fast
- LIMIT 8 on suggestions keeps response small
- `type=all` limits each sub-query to 3 results, merges top 8
- No trigram index on long text fields (event descriptions) — use ILIKE fallback
- Business category search requires LEFT JOIN to `businessCategories` table
