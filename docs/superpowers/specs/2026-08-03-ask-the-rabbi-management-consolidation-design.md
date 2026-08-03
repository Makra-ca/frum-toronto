# Ask the Rabbi — management consolidation

**Date:** 2026-08-03
**Status:** Approved. Revised after adversarial review; all decisions resolved.

## Problem

Ask the Rabbi is managed from two pages in two different shells, and neither one is complete.

`/admin/programs/rabbi` is wired only to `ask_the_rabbi_submissions`. That table has **zero rows and always
has** — so the entire Ask the Rabbi admin panel renders "No pending submissions found". An admin cannot see
the 5,521 published Q&As, cannot edit one, and cannot write a new one from anywhere in `/admin`.

`/dashboard/ask-the-rabbi` holds the Q&A library, the composer and a comment queue, but has no submissions
inbox — so the one person whose job is answering questions would never see one arrive.

Comment moderation is implemented **twice**, against the same API, with different capabilities.

### Verified state (production, 2026-08-03)

| Fact | Value |
|---|---|
| `ask_the_rabbi` rows | 5,521 — all `is_published = true`, 0 unpublished |
| `ask_the_rabbi_submissions` rows | **0** (never received one) |
| `ask_the_rabbi_comments` rows | 1, approved, on question 5527. 0 pending |
| Users with `can_manage_ask_the_rabbi` | 1 — id 7, `rabbi.bartfeld@frumtoronto.com`, role `member` |
| Users with role `admin` | 1 — id 2, `admin@…`, `can_manage_ask_the_rabbi = false` |

Rabbi Bartfeld is a `member`, so he is blocked from `/admin` twice over — `src/lib/auth/auth.config.ts:17`
and `(admin)/admin/layout.tsx:18-20`. **A non-admin surface must keep existing.** Consolidating everything
into `/admin` is not available without a permission change nobody wants for one user.

### Coverage today

| Screen | Admin panel | Dashboard |
|---|---|---|
| Submissions inbox | yes | no |
| Q&A library (5,521) | no | yes |
| New Q&A | no | yes |
| Comment moderation | yes — status filter + delete, body truncated to 100 chars | yes — pending only, no delete, full body |

## Approach

Extract the four screens into shared components and render them from two thin shells. Considered and
rejected: moving everything into `/admin` (needs a permission change for one user), and merely cross-linking
the two pages (leaves the duplication).

### The API work this requires

An earlier draft of this document claimed every route already gates on
`role === "admin" || canManageAskTheRabbi`, so no API work was needed. **That was wrong**, and it was wrong
about the single most important screen. Corrected:

| Route | Guard today |
|---|---|
| `api/admin/ask-the-rabbi/route.ts` (GET/PATCH/DELETE) | capability — `isAuthorized()`, lines 11-22 |
| `api/admin/ask-the-rabbi/comments/**` | capability |
| `api/ask-the-rabbi/quick-post/route.ts` | capability, lines 41-50 |
| **`api/admin/rabbi-submissions/route.ts`** (GET :12, POST :110) | **`role === "admin"` only** |
| **`api/admin/rabbi-submissions/[id]/route.ts`** (GET :15, PATCH :56, DELETE :111) | **`role === "admin"` only** |

The submissions inbox calls exactly those five handlers
(`(admin)/admin/programs/rabbi/page.tsx:81, 124, 158, 181`). Rendering that component in `/dashboard`
without changing them gives Rabbi Bartfeld a tab where the list and every action return 401.

**Required:** extract the `isAuthorized()` helper from `api/admin/ask-the-rabbi/route.ts:11-22` into a
shared module and apply it to all five `rabbi-submissions` handlers. This widens access for exactly one
person, who already holds the capability that governs every other Ask the Rabbi screen.

There is also a **dead duplicate**: `api/admin/ask-the-rabbi/submissions/[id]/answer/route.ts` (196 lines)
is capability-gated and implements its own publish logic, but nothing in `src/` calls it — it duplicates
`rabbi-submissions/route.ts:141-175`. It is deleted; see Resolved decisions.

### Target structure

New directory `src/components/ask-the-rabbi/manage/`:

| Component | Extracted from | Notes |
|---|---|---|
| `SubmissionsInbox.tsx` | `(admin)/admin/programs/rabbi/page.tsx` (538 lines) | Status tabs + answer dialog |
| `QuestionsLibrary.tsx` | `(dashboard)/dashboard/ask-the-rabbi/page.tsx` (828 lines) | Table, search, publish toggle, delete |
| `QuestionEditDialog.tsx` | same | Used by the library |
| `CommentsModeration.tsx` | `(admin)/.../rabbi/comments/page.tsx` (399 lines) | Admin version is the base — see below |
| `AtrQuickPost.tsx` | already shared, stays where it is | Also rendered on the public page |

Two shells render the same four tabs, in this order and with these labels:

**Submissions · Questions · New · Comments**

- `/admin/programs/rabbi` — a sub-tab row beneath the existing Programs tabs. Defaults to Submissions.
- `/dashboard/ask-the-rabbi` — same four tabs in the existing card shell. Its permission probe (an API call
  whose 200 means "allowed", `page.tsx:703-707`) is unchanged.

"Submissions" is the inbox of things people sent in; "Questions" is the published library. That distinction
is the one that matters, so the labels carry it.

### Comment moderation: keep the admin version, port one thing back

The admin implementation wins on capability — status filter (`comments/page.tsx:203-222`), delete with
confirm (`:317-325, 366-396`), re-approve of non-pending rows (`:306-316`).

But it **truncates every comment body to 100 characters** (`:187-190, 262`) inside a `line-clamp-2`, while
the dashboard version shows the full text (`page.tsx:621`). Moderating on 100 characters is a real loss for
the person doing the job. The merged component takes the admin feature set **and** the untruncated body. It
should also keep the dashboard's per-row in-flight state (`actingId`, `page.tsx:514, 632`), which the admin
version lacks — without it a double-click fires the action twice.

### Tabs must be deep-linkable

Both shells currently track the active tab in local `useState` (`(dashboard)/…/page.tsx:696`; admin page
`:61`). Three server-side links point into these pages and must land on the right tab:

| Source | Current target |
|---|---|
| `api/ask-the-rabbi/[id]/comments/route.ts:223` | `/admin/programs/rabbi/comments` — **page being deleted** |
| `api/cron/notification-digest/route.ts:86` | `/admin/programs/rabbi/comments` — **page being deleted** |
| `api/ask-the-rabbi/submit/route.ts:67` | `/admin/programs/rabbi` |

So the tab state needs a `?tab=` query-param contract, and those three `linkUrl`s must be repointed. An
earlier draft claimed deleting the comments page only broke one button; it breaks all three.

### Deleted

- `src/app/(admin)/admin/programs/rabbi/comments/page.tsx` and the "Moderation Comments" button
  (`rabbi/page.tsx:214-219`).
- The duplicate `PendingCommentsTab` inside the dashboard page.

### Unchanged

Permissions model, roles and middleware — no new role, no change to who may enter `/admin`. The database
schema. Both page URLs. All 5,521 published Q&As. The `/api/admin/ask-the-rabbi` and
`/api/admin/ask-the-rabbi/comments` routes.

### Extraction hazards (verified)

- `AtrQuickPost` calls `router.refresh()` on success (`:75`). That refreshes server-rendered content, so it
  is a **no-op for the dashboard's client-fetched lists** — publishing from the New tab will not update the
  Questions tab. Needs an explicit callback if the tabs should stay in sync.
- The admin comments page renders **no `<h1>`** — it inherits "Programs" from
  `(admin)/admin/programs/layout.tsx:19`, while the dashboard shell supplies its own `CardTitle`. Extracted
  components must own no page heading; each shell provides its own.
- `AtrQuickPost` uses `useSession` (`:19`), available in both shells via the root `SessionProvider`.
- There is no `(dashboard)/layout.tsx`; that page renders under the root `LayoutWrapper` with the public
  Header and Footer. Both "shells" are real but not symmetrical.
- `UniversalSearch` and `formatInstant` are shell-agnostic.

## Bug fixes in scope

Two live defects in Quick Publish, found while reading the code. Both sit in files this work already
touches, so they ship together.

### 1 · Q&As are credited to whoever posted them

`AtrQuickPost` has no "Answered By" field, so the API falls back to the session user's name
(`quick-post/route.ts:65-68`):

```ts
const resolvedAnsweredBy =
  answeredBy ||                                    // form never sends it
  [session.user.name].filter(Boolean).join("") ||  // so it lands here
  "FrumToronto Rabbi";
```

Live result across all 5,521 rows: 5,511 correctly read *Hagaon Rav Shlomo Miller Shlit'a*, 9 read
"Admin User", 1 reads "Rabbi Bartfeld".

The answer-a-submission dialog gets this right — it defaults the field to the Rav. Only Quick Publish is
missing it.

**Fix:** add an "Answered By" input to `AtrQuickPost`, defaulted to `Hagaon Rav Shlomo Miller Shlit'a`. The
`answered_by` column **already carries that string as its DB default** (`schema.ts:539`, confirmed live), so
the API must **delete the `resolvedAnsweredBy` fallback entirely** and omit the field when the form sends
nothing — merely bypassing the fallback leaves the same bug for any other caller, and the regression test
below only passes if it is removed.

**Backfill:** update these 9 rows to the Rav — ids 5520–5528, question numbers 8205–8213, the numbered
6012–6024 series, published 2026-07-23 to 2026-08-03.

Note this field also appears on the public `/ask-the-rabbi` page, where `AtrQuickPost` renders for permitted
users. That is intended; see Resolved decisions.

### 2 · The "Published At" date picker does nothing

The form collects a date and sends it (`AtrQuickPost.tsx:60`). `quickPostSchema`
(`quick-post/route.ts:12-21`) doesn't list `publishedAt`, so Zod strips it — `z.object()` discards unknown
keys silently rather than erroring — and the insert hard-codes `publishedAt: new Date()` (line 86).
Backdating silently fails.

**Fix:** add `publishedAt` to the schema and use it, falling back to now when absent.

**Timezone trap:** the form sends a bare `yyyy-mm-dd` (`AtrQuickPost.tsx:26, 60`). `new Date("2026-08-03")`
parses as **UTC midnight**, which `formatInstant` then renders in `America/Toronto` as the previous day. The
existing PATCH handler already has this bug (`api/admin/ask-the-rabbi/route.ts:153`). Parse through the
repo's `fromDateTimeInputs` helper (`src/lib/datetime.ts:168`) and pin the timezone in the test — this is
the same class of defect as the 2026-07-30 timezone session.

## Data cleanup in scope

**Delete `ask_the_rabbi` id 5519** — question #8204, *"THis is a test for Ask the rabbi"*, posted
2026-05-26, `is_published = true`. Test content live on a public Torah Q&A page. It is one of the 10
mis-attributed rows but must **not** be backfilled — re-crediting a test post to the Rav makes it worse.

Verified safe: the single comment in the table is on question 5527, not 5519, and
`ask_the_rabbi_comments.question_id` is `ON DELETE CASCADE` regardless. `/ask-the-rabbi/5519` will 404 for
any existing inbound link.

`question_number` is `UNIQUE` (`schema.ts:534`) and new numbers come from `MAX(question_number) + 1`,
currently 8213, so freeing 8204 leaves a gap that is never reused. Nothing depends on the sequence being
contiguous.

## Resolved decisions

**1 · The dead answer route is deleted.** `api/admin/ask-the-rabbi/submissions/[id]/answer/route.ts` (196
lines, capability-gated, no callers) duplicates the live publish path at `rabbi-submissions/route.ts:141-175`.
It appears to be an abandoned earlier attempt at this same migration. The live path stays and gets a
one-line guard change; the dead file is removed. Rationale: the live path has been running in production for
months, so swapping in never-executed code to save one line is the worse trade. Two publish
implementations is the thing being eliminated, and keeping the untested one is not a way to do that.

**2 · "Answered By" appears everywhere `AtrQuickPost` renders**, including the public `/ask-the-rabbi:162`
instance. No prop gating. The only people who can see that form are the same people who see the two
management shells, so making one copy behave differently would be an inconsistency with no beneficiary.

## Known, out of scope

`MAX(question_number) + 1` is not atomic — `quick-post/route.ts:70` carries a comment claiming it is
computed "inside the insert for safety", which it is not; it is a separate SELECT. Two concurrent publishes
would collide on the unique index and 500. Pre-existing and vanishingly unlikely at one or two posts a week,
but the plan touches this file, so the misleading comment should be corrected even if the behaviour is not.

## Risk and verification

The component moves are mechanical. The genuine risks are the API guard change, the three repointed
notification links, and the two writes to production data — the 9-row backfill and the 1-row delete, both of
which need the row list re-confirmed immediately before execution and are reversible from the values
recorded here.

Verify by exercising all four tabs in both shells, as an admin and as a `member` holding only
`canManageAskTheRabbi` — the second must now succeed on submissions actions, and must still be refused at
`/admin`. `tsc` to zero errors; eslint no worse than the existing baseline.

Both bug fixes need a regression test that fails against the current code first: one proving `publishedAt`
survives validation and lands on the intended Toronto day, and one proving an absent `answeredBy` yields the
Rav rather than the poster.

## Decisions

| Decision | Choice |
|---|---|
| Structure | Shared components rendered by both shells |
| Bug fixes | Same branch as the restructure |
| Byline | Add the field defaulted to the Rav; remove the API fallback; backfill the 9 genuine rows |
| Backdating | Make `publishedAt` work, parsed as Toronto |
| Test post #8204 | Delete |
| Comment moderation | Admin implementation, plus the dashboard's full body and per-row in-flight state |
| Submissions API | Capability-gate the five `rabbi-submissions` handlers |
| Dead answer route | Delete it; keep the live publish path |
| "Answered By" on the public page | Show it — no prop gating |
