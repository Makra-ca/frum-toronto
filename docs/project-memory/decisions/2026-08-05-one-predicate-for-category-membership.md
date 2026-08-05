---
name: one-predicate-for-category-membership
description: Every browse and count surface asks businessInCategory(); no call site filters on category_id directly
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** "This listing belongs to category X" has exactly one definition —
`businessInCategory(categoryId)` in `src/lib/businesses/categories.ts` — and
every surface that browses or counts by category calls it. No call site filters
on `businesses.category_id` directly.

```sql
(category_id = $1 OR additional_category_ids @> $1::jsonb)
```

Six surfaces now share it: `/directory/[slug]` (listing + city facet), its API,
`/directory/search`, its API, the per-category counts on `/directory`, and the
"Also listed in" block on a listing page. The two raw-SQL count queries use the
same shape via `to_jsonb(bc.id)`.

**Context:** `additional_category_ids` was written by the submission form and
read by **nothing**. A listing filed under three categories appeared on exactly
one, while the pricing table sold "3 categories" on Standard and "5" on Premium.
The column had existed unused since the tier work in February 2026.

**Chose over:** filtering on the array inline at each call site. Rejected
because `/directory` renders a **count** per category from a different query
than the one `/directory/[slug]` **lists** with. If those two drift, the count
says 4 and the page shows 3 — invisible in review, obvious to a user. A shared
predicate makes divergence impossible rather than merely unlikely; a test pins
the two together.

**Consequences and gotchas:**

- **`@>` compares values, not text.** `'[3,5]'::jsonb @> '35'::jsonb` is
  `false`, verified against the database — ids 3 and 35 cannot be confused.
- **Containment against a NULL column yields NULL, not false.** Harmless in a
  `WHERE` (NULL and false both drop the row), but **not** under negation:
  `NOT businessInCategory(x)` is NULL for every listing with no extras and
  silently excludes all of them. Wrap in `COALESCE(..., false)` before negating.
- Writes go through `normalizeAdditionalCategoryIds()`, which de-duplicates and
  strips the primary id — jsonb enforces no uniqueness and no foreign keys, so a
  repeated id would list a business twice on one page and burn two of its plan
  allowance on one category. It returns `null`, never `[]`, matching how every
  existing row reads.
- No GIN index was added; at ~1,635 rows the planner is unlikely to use one. Add
  one if the table grows an order of magnitude.

Related: [[category-required-admins-exempt]], [[forms-collect-what-the-directory-needs]]
