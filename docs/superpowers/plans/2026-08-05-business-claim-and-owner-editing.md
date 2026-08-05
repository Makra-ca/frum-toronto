# Business Claiming and Owner Editing — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business owner take charge of their listing and keep it accurate, without the listing ever going dark.

**Architecture:** Two new tables. Claiming copies the proven shul-request shape. Editing writes proposed values to a separate pending-changes table so the live row is never touched, and the admin approves field by field. A trusted owner skips the queue.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres (`neon-http`, **no transactions**), Zod, vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-04-business-claim-and-owner-editing-design.md`, Parts 1–3.

**Prerequisite:** `docs/superpowers/plans/2026-08-05-finish-business-fields.md` must ship first. Without it the editor offers a logo nothing can store.

---

## Context an engineer new to this codebase needs

**There are no transactions.** `db` is `neon-http`; `db.transaction` does not exist — the only mention in `src/` is a comment explaining its absence. Two operations in this plan look atomic and are not, so each specifies an **order chosen so a mid-sequence failure fails safe**. Follow the stated order; it is not arbitrary.

**Measured on production, 2026-08-04:** 1,635 businesses, **2 with an owner** (ids 1634 `pending_payment`, 1635 `pending`), 0 subscriptions ever created, 1,634 on Free.

**Both owned listings are unapproved**, so the "owner of an unapproved listing" path is the *only* one that exercises on day one. Do not treat it as an edge case.

**The reused authorization idiom** is `!isAdmin && business.userId !== userId` → 403. Five existing owner-facing routes use it verbatim (`non-profit`, `shoutouts`, `shoutouts/[shoutoutId]`, `video`, `video/uploaded`). Copy it; do not invent a variant.

**Every mutating route calls `assertCanPost`** (`src/lib/auth/require-verified.ts`) — logged in, account active, email verified, admins exempt.

**Test projects.** `npm run test:unit` needs no database. `npm run test:integration` needs `.env.test`, runs `tests/*.test.ts` (not nested), sequentially. Route tests need a **hoisted** `vi.mock` of `@/lib/auth/auth` — `vi.mock` inside `it()` does nothing, and routes 401 before touching the database, so an unmocked test passes against broken code.

**Migrations** go in `migrations/YYYY-MM-DD-<name>.sql` and are applied with `npx tsx scripts/apply-sql-file.ts <file>` — **and again with `--test`** for the Neon test branch. A migration applied to only one of the two is how a previous session got every plan-capability test failing at once.

**Run `tsc` before every commit.** Drizzle silently ignores unknown keys in `.set()` and `.values()`.

**eslint baseline: 49 errors / 182 warnings.** Do not fix the pre-existing ones.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `migrations/2026-08-05-business-claims-and-changes.sql` | Both tables, their partial unique indexes, and the `businesses.user_id` FK change |
| `src/lib/businesses/claims.ts` | Claim state transitions — the single writer |
| `src/lib/businesses/pending-changes.ts` | Diff, supersede, and per-field apply — the single writer |
| `src/lib/businesses/notify-owner.ts` | Business-specific submitter notifications |
| `src/app/api/businesses/[id]/claim/route.ts` | POST submit · DELETE withdraw |
| `src/app/api/businesses/[id]/pending-change/route.ts` | GET · DELETE withdraw |
| `src/app/api/user/business-claims/route.ts` | GET own claims |
| `src/app/api/admin/business-claims/route.ts` | GET queue |
| `src/app/api/admin/business-claims/[id]/route.ts` | PATCH approve/reject |
| `src/app/api/admin/businesses/[id]/owner/route.ts` | PUT assign · DELETE revoke |
| `src/app/api/admin/business-changes/route.ts` | GET queue |
| `src/app/api/admin/business-changes/[id]/route.ts` | PATCH per-field approve |
| `src/app/(admin)/admin/businesses/claims/page.tsx` | Claims tab |
| `src/app/(admin)/admin/businesses/changes/page.tsx` | Changes tab |
| `src/components/directory/ClaimCta.tsx` | Client component — the four-state CTA |
| `src/components/business/OwnerEditor.tsx` | The owner's edit form |

**Modified**

| File | Change |
|---|---|
| `src/lib/db/schema.ts` | Both tables; `businesses.userId` gains `onDelete: "set null"` |
| `src/lib/validations/content.ts` | `ownerBusinessEditSchema` |
| `src/app/api/businesses/[id]/route.ts` | GET returns the editable fields + remaining plan flags; new PATCH |
| `src/lib/notifications.ts` | Two `SubmissionContentType` values |
| `src/app/api/cron/notification-digest/route.ts` | Two counts, two `categories` entries |
| `src/app/(admin)/admin/businesses/layout.tsx` | Two tabs (7 → 9) |
| `src/app/directory/business/[slug]/page.tsx` | Mount `ClaimCta` |
| `src/app/(dashboard)/dashboard/page.tsx:222` | Gate on ownership-or-claim, not role |
| `src/app/(dashboard)/dashboard/business/page.tsx` | Claim states + empty state |
| `src/app/(dashboard)/dashboard/business/[id]/page.tsx` | Mount `OwnerEditor` |
| `src/lib/permissions/auto-approve-targets.ts` | `canAutoApproveBusinesses` leaves creation |
| `src/app/api/businesses/create/route.ts` | Drops the flag argument |
| `src/components/admin/UserTable.tsx` | Toggle label reflects the new meaning |
| `tests/dead-permission-toggles.test.ts` | Four assertions change |

---

## Chunk 1: Schema and the claim lifecycle

### Task 1: The migration

**Files:**
- Create: `migrations/2026-08-05-business-claims-and-changes.sql`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Business claiming and owner editing.
-- One row per submission for changes, not per field: hours, social_links and
-- additional_category_ids are all jsonb, and an EAV table would stringify them.

CREATE TABLE IF NOT EXISTS business_claims (
  id               serial PRIMARY KEY,
  business_id      integer NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message          text,
  status           varchar(20) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by      integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      timestamp,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

-- One OPEN claim per person per listing. A rejected claimant may resubmit,
-- because the old row is no longer 'pending'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_claims_open
  ON business_claims (business_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_business_claims_status ON business_claims (status);

CREATE TABLE IF NOT EXISTS business_pending_changes (
  id            serial PRIMARY KEY,
  business_id   integer NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  submitted_by  integer REFERENCES users(id) ON DELETE SET NULL,
  proposed      jsonb NOT NULL,
  previous      jsonb NOT NULL,
  outcome       jsonb,
  status        varchar(20) NOT NULL DEFAULT 'pending',
  reviewed_by   integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   timestamp,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

-- At most one waiting change per listing — this is what "a second edit
-- replaces the first" means. Replacement marks the old row 'superseded',
-- which frees the index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_changes_open
  ON business_pending_changes (business_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_business_changes_status ON business_pending_changes (status);

-- Deleting a user who owns a business currently raises an FK error.
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_users_id_fk;
ALTER TABLE businesses ADD CONSTRAINT businesses_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

Status values — claims: `pending` · `approved` · `rejected` · `auto_rejected` ·
`withdrawn`. Changes: `pending` · `reviewed` · `superseded` · `discarded`.

- [ ] **Step 2: Apply to BOTH databases**

```bash
npx tsx scripts/apply-sql-file.ts migrations/2026-08-05-business-claims-and-changes.sql
npx tsx scripts/apply-sql-file.ts migrations/2026-08-05-business-claims-and-changes.sql --test
```

Applying to only one is how a previous session got every capability test failing
at once.

- [ ] **Step 3: Mirror in `schema.ts`**

Add both tables following the `shulRegistrationRequests` shape, and change
`businesses.userId` to carry `{ onDelete: "set null" }`. Give both new tables
`updatedAt` with `$onUpdate(() => new Date())` — 17 columns were repaired
recently for lacking it.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
git add migrations/ src/lib/db/schema.ts
git commit -m "feat(businesses): claims and pending-changes tables

Partial unique indexes enforce one open claim per person per listing and one
waiting change per listing. businesses.user_id gains ON DELETE SET NULL —
deleting an owner currently raises a foreign-key error."
```

---

### Task 2: Claim state transitions

**Files:**
- Create: `src/lib/businesses/claims.ts`
- Create: `tests/business-claims.test.ts`

- [ ] **Step 1: Write the failing test**

Cover, in this order: submitting sets `pending`; a second submission by the same
user on the same listing is refused **before** hitting the index (so the caller
gets a clear error, not a constraint violation); approving sets
`businesses.user_id`; approving **auto-rejects rival claims**; and the ordering
guarantee — rivals are rejected *before* the owner is set, so a mid-sequence
failure leaves nobody owning the listing rather than two people believing they do.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:integration -- business-claims`

- [ ] **Step 3: Write the module**

`approveClaim` order, and it matters:

```ts
// No transactions on neon-http. Reject rivals FIRST: a failure between the two
// leaves rivals rejected and no owner, which is recoverable by approving again.
// The reverse order can leave two people believing they own the listing.
await db.update(businessClaims)
  .set({ status: "auto_rejected", reviewedBy, reviewedAt: new Date() })
  .where(and(
    eq(businessClaims.businessId, businessId),
    eq(businessClaims.status, "pending"),
    ne(businessClaims.id, claimId),
  ));

await db.update(businesses).set({ userId: claimantId }).where(eq(businesses.id, businessId));

await db.update(businessClaims)
  .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
  .where(eq(businessClaims.id, claimId));
```

- [ ] **Step 4: Pass, typecheck, commit**

---

### Task 3: Claim routes

**Files:**
- Create: `src/app/api/businesses/[id]/claim/route.ts` (POST, DELETE)
- Create: `src/app/api/user/business-claims/route.ts` (GET)
- Create: `tests/business-claim-routes.test.ts`

- [ ] **Step 1: Failing tests**

Claimable requires **approved AND `isActive`** — the public page requires both,
so an approved-but-deactivated listing has no page to claim from. Also: a
listing that already has an owner refuses the claim; an unverified user is
refused by `assertCanPost` with its distinguishable code.

- [ ] **Step 2–4: Implement, pass, commit**

---

### Task 4: Admin claim queue and ownership controls

**Files:**
- Create: `src/app/api/admin/business-claims/route.ts`, `.../[id]/route.ts`
- Create: `src/app/api/admin/businesses/[id]/owner/route.ts`
- Create: `tests/admin-business-ownership.test.ts`

- [ ] **Step 1: Failing tests**

Assigning over an existing owner returns **409**, not a silent overwrite —
replacing an owner is revoke-then-assign, so removal is deliberate. Revoking
sets `businesses.user_id` to null and **discards any pending change**
(`status = 'discarded'`), telling the owner.

- [ ] **Step 2–4: Implement, pass, commit**

---

## Chunk 2: Owner editing

### Task 5: The read path

`GET /api/businesses/[id]` returns identity, video, non-profit, dining type, the
main category and four plan flags. It returns **none of the other editable
fields**, so nothing seeds the form.

**Files:**
- Modify: `src/app/api/businesses/[id]/route.ts`
- Create: `tests/business-read-path.test.ts`

- [ ] **Step 1: Failing test** — assert the response carries phone, email,
  website, address, city, postalCode, description, hours, logoUrl, contactName,
  socialLinks, additionalCategoryIds, plus `showDescription`, `showEmail`,
  `showWebsite`, `showHours`, `showLogo`, `showSocialLinks`, `showContactName`
  and `maxCategories`.

- [ ] **Step 2–4: Extend the select, pass, commit**

---

### Task 6: `ownerBusinessEditSchema`

**Do not reuse `businessSchema`.** It requires `name` and carries `isFeatured`,
`isKosher`, `kosherCertification` and `bannerImageUrl` — all never-editable. A
`.partial()` of it accepts every one.

**Files:**
- Modify: `src/lib/validations/content.ts`
- Create: `tests/unit/owner-edit-schema.test.ts`

- [ ] **Step 1: Failing unit test** — the schema accepts the editable fields and
  **rejects** `isFeatured`, `name`, `approvalStatus`, `subscriptionPlanId` and
  `userId`. Use `.strict()` so unknown keys are an error rather than silently
  stripped — the opposite of the `publishedAt` bug, where stripping hid the
  problem for months.

- [ ] **Step 2–4: Implement, pass, commit**

---

### Task 7: The diff and supersede logic

**Files:**
- Create: `src/lib/businesses/pending-changes.ts`
- Create: `tests/business-pending-changes.test.ts`

- [ ] **Step 1: Failing tests**

- Only **changed** fields land in `proposed`; unchanged ones are omitted.
- `previous` captures the value **at submission**, so the diff shows what the
  owner was looking at.
- A second submission marks the first `superseded` and inserts a new `pending` —
  the partial unique index is what makes this correct.
- JSONB fields (`hours`, `socialLinks`, `additionalCategoryIds`) are **one field
  each** for diffing and review, not split.
- **Unapproved listing** → written straight to the row, no pending change. Both
  real owners are in this state, so this is the day-one path.
- **Trusted owner or admin** → applied immediately, and a row is still written
  with `status = 'reviewed'` and a fully-applied `outcome`, so "who changed what"
  is durable.

- [ ] **Step 2–4: Implement, pass, commit**

---

### Task 8: The owner PATCH and editor

**Files:**
- Modify: `src/app/api/businesses/[id]/route.ts` (add PATCH)
- Create: `src/app/api/businesses/[id]/pending-change/route.ts`
- Create: `src/components/business/OwnerEditor.tsx`
- Modify: `src/app/(dashboard)/dashboard/business/[id]/page.tsx`

- [ ] **Step 1: Failing route tests**

Tier gating is **server-side too** — the API rejects a value for a field the
caller's plan does not display. Hiding it in the form is not enforcement.

**Categories are the exception**: gated by a count, not a flag, so the control is
always present and **removal is always allowed**, including over the cap.
Otherwise a business downgraded from Standard to Free can never clear the excess.

- [ ] **Step 2: Implement the PATCH**

- [ ] **Step 3: Build the editor**

Fields the plan does not display are absent. A pending change shows above the
form: "Your changes are awaiting review", listing each field. Trusted owners see
no waiting state.

- [ ] **Step 4: Verify in a browser, commit**

---

## Chunk 3: Review, notification and the rework

### Task 9: Per-field approval

**Files:**
- Create: `src/app/api/admin/business-changes/route.ts`, `.../[id]/route.ts`
- Create: `tests/business-change-review.test.ts`

- [ ] **Step 1: Failing tests**

- Approving four fields and rejecting one writes **only the four**.
- The rejected field carries its optional reason.
- **Approval-time re-validation** — `maxCategories` against the *resulting* set,
  category existence, plan gating, and dining type against the resulting
  category. Per-field approval can otherwise produce a combination the owner
  never proposed.
- A failed re-check blocks **that field**, not the whole review.
- **Order**: write `outcome` and `status` **before** the listing row. A failure
  between them leaves a recorded, re-appliable change rather than a silently
  changed listing the owner is never told about.
- Approving an image change **deletes the blob it supersedes**; rejecting
  deletes the proposed one.
- `revalidatePath` the public listing.

- [ ] **Step 2–4: Implement, pass, commit**

---

### Task 10: Notifications

**Files:**
- Create: `src/lib/businesses/notify-owner.ts`
- Modify: `src/lib/notifications.ts`, `src/app/api/cron/notification-digest/route.ts`

- [ ] **Step 1: Failing tests**

Add `business_claim` and `business_change` to `SubmissionContentType` **only** —
no `INSTANT_EMAIL_TYPES` entry, and therefore **no `FORM_TYPE_BY_CONTENT` entry**,
which is read solely inside the instant-email branch and would be dead config.

`notifySubmitter` cannot express a per-field outcome — its signature is
`{ approved: boolean, reason, … }` and its link falls back to
`/dashboard/submissions`, which will never list a business change. So a
**business-specific notifier**, linking to `/dashboard/business/[id]`, covering
change review **and all three claim outcomes** (approve, reject, auto-reject).

- [ ] **Step 2: Digest**

Two counts and two `categories` entries pointing at `/admin/businesses/claims`
and `/admin/businesses/changes`. These read **`status = 'pending'`** on the new
tables; ten of the eleven existing counts read `approval_status`, so the pattern
does not transfer verbatim.

*(The digest cron has never run — `CRON_SECRET` is unset. See
`docs/project-memory/SECURITY-FINDINGS-2026-08-04.md` item 1.)*

- [ ] **Step 3–4: Pass, commit**

---

### Task 11: Admin screens

**Files:**
- Create: `src/app/(admin)/admin/businesses/claims/page.tsx`, `.../changes/page.tsx`
- Modify: `src/app/(admin)/admin/businesses/layout.tsx`

Both are **path segments**, matching all seven existing tabs. Nine total. Both
queues are **empty on day one**, so each needs a real empty state.

---

### Task 12: The claim CTA

**Files:**
- Create: `src/components/directory/ClaimCta.tsx`
- Modify: `src/app/directory/business/[slug]/page.tsx`

A **client component with its own fetch**. Server-rendering it would make every
listing per-viewer and moot the `revalidatePath` work in Task 9.

Four states: claim · "awaiting review" · "report a problem" (links to `/contact`,
which gains a "Business listing" category — it **cannot** be pre-filled, having
no `useSearchParams`) · nothing. The claim form is a modal opened by `?claim=1`,
which gives the login redirect a `callbackUrl` to return to.

---

### Task 13: The `canAutoApproveBusinesses` rework

**Files:**
- Modify: `src/lib/permissions/auto-approve-targets.ts`, `src/app/api/businesses/create/route.ts`, `src/components/admin/UserTable.tsx`
- Modify: `tests/dead-permission-toggles.test.ts`

`268b1f1` is **deployed**, so this changes shipped behaviour — though nobody
holds the flag except the admin account, for whom it is redundant.

Delete the `canAutoApproveBusinesses` arm from `resolveBusinessApprovalStatus`
so creation depends on `isTrusted` alone; `BusinessApprovalInput` loses a field.
Four assertions in `dead-permission-toggles.test.ts` change. Two pieces of admin
copy still describe the old meaning: the permissions dialog label in
`UserTable.tsx`, and the module docstring of `auto-approve-targets.ts`.

---

### Task 14: Dashboard access

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx:222`, `.../business/page.tsx`

Gate the link on **owning a business or having a claim in any state** — not
`role === "business"`. A pending claimant owns nothing yet and would otherwise
have no way to reach their own claim. The page fetches businesses only today, so
a claims lookup is added.

Do **not** promote anyone's role: `token.role` is set at sign-in, so a promoted
user would see nothing until they logged out and back in.

---

### Task 15: Final verification

- [ ] **Automated:** `tsc`, both test projects, lint at baseline, `next build`.

- [ ] **As an admin:** approve a claim; confirm rivals auto-reject. Assign
  directly; confirm assigning over an owner 409s. Revoke; confirm the pending
  change is discarded. Review a five-field change, approve four, reject one with
  a reason; confirm only four land and the listing revalidates.

- [ ] **As an owner** (create a throwaway `member`, claim a listing, approve it):
  edit and confirm the listing **stays live** with the old values while the
  change waits. Confirm a second edit replaces the first. Confirm the notification
  and email name the fields.

- [ ] **As a trusted owner** (`canAutoApproveBusinesses`): confirm edits apply
  immediately and a `reviewed` row is still written.

- [ ] **On an unapproved listing:** confirm edits write straight through with no
  pending change — this is the state both real owners are in.

- [ ] **Confirm the capability is not a way into `/admin`.**

---

## Definition of done

- A user can claim an approved, active listing; the admin approves, and rivals auto-reject.
- The admin can assign and revoke ownership directly.
- An ordinary owner's edit queues; **the listing stays live and unchanged**.
- The admin approves field by field, with an optional per-field reason.
- The owner is told which fields went live, which did not, and why.
- A trusted owner's edits apply immediately, and a durable record still exists.
- An unapproved listing's owner writes straight through.
- `canAutoApproveBusinesses` gates edits, not creation.
- `tsc` 0 errors, tests green, eslint no worse than baseline, build compiles.
