# User Submissions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see, edit and hear back about the content they submit, without an edit ever re-broadcasting to the whole subscriber list.

**Architecture:** One shared writer (`setApprovalStatus`) owns every approval transition, the broadcast decision and the submitter notification. A new `pending_edit` status distinguishes a correction from a new submission so broadcast guards can tell them apart. Per-type edit modules hold only the rules that genuinely differ; everything else is shared.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, NextAuth v5, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-user-submissions-design.md` — read it before starting. The *broadcast defect* section explains why `pending_edit` exists; do not simplify it away.

---

## Before you start

Read these, in this order:

1. `docs/superpowers/specs/2026-07-30-user-submissions-design.md` — the design and the decisions
2. `src/lib/datetime.ts` — the header comment explains why instants and dates must never share a formatter
3. `src/lib/notifications.ts` — the existing admin notifier you are mirroring
4. `src/app/api/admin/content/[type]/[id]/approve/route.ts` — the broadcast this plan is working around

**Environment notes that will waste your time otherwise:**

- Every migration must be applied **twice** — once to primary, once to the Neon test branch:
  ```bash
  npx tsx scripts/apply-sql-file.ts migrations/<file>.sql
  npx tsx scripts/apply-sql-file.ts migrations/<file>.sql --test
  ```
  Skipping `--test` makes every integration test fail with `column ... does not exist`.
- Unit tests run pinned to `TZ=UTC` (see `vitest.config.mts`) because that is what Vercel runs. Do not remove that.
- Integration tests need `.env.test`. A burst of `NeonDbError: fetch failed` across unrelated files means the test branch suspended — re-run before investigating.
- Run `npx tsc --noEmit` before every commit. The repo has 8 pre-existing eslint errors unrelated to this work; do not try to fix them.

---

## File structure

| File | Responsibility |
|---|---|
| `migrations/2026-07-31-submission-edits.sql` | `pending_edit` support, `rejection_reason`, `updated_at` |
| `src/lib/submissions/types.ts` | `SubmissionType` union, per-type config table (owner column, date kind, permission flag) |
| `src/lib/submissions/ownership.ts` | `canEditRow` — owner OR current shul manager |
| `src/lib/submissions/auto-approve.ts` | `resolveApprovalStatus` — shared by create and edit |
| `src/lib/submissions/set-approval-status.ts` | The single writer: transition, broadcast decision, notify |
| `src/lib/notifications.ts` | *(modify)* add `notifySubmitter` |
| `src/lib/email/templates.ts` | *(modify)* two transactional templates |
| `src/lib/events/edit-submission.ts` | *(modify)* use the shared helpers; fix the auto-approve defect |
| `src/app/api/user/submissions/route.ts` | *(modify)* add `detailKind`, `canEdit`, `isPast`, `rejectionReason` |
| `src/app/(dashboard)/dashboard/submissions/page.tsx` | *(modify)* branch on `detailKind`; past toggle |

Per-type edit modules live at `src/lib/<type>/edit-submission.ts`, mirroring the events one.

---

## Chunk 1: Shared foundations

Nothing else works until this is right. No user-visible change lands in this chunk.

### Task 1: Migration

**Files:**
- Create: `migrations/2026-07-31-submission-edits.sql`

- [ ] **Step 1: Write the migration**

```sql
-- pending_edit distinguishes a correction from a new submission, so the
-- broadcast guards in admin/content/.../approve fire only on pending -> approved.
-- Without this, re-approving an edited shiva notice re-emails the whole community.

ALTER TABLE events              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Concurrency: only blog_posts had one. Without it a user edit racing an
-- admin approval is last-write-wins and can publish unreviewed content.
ALTER TABLE events              ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Admin queues order by this so an edited old item resurfaces at the top
-- instead of sinking to the bottom by created_at.
CREATE INDEX IF NOT EXISTS idx_events_updated      ON events (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_simchas_updated     ON simchas (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifieds_updated ON classifieds (updated_at DESC);
```

`approval_status` is a `varchar(20)` with no CHECK constraint, so `pending_edit` (13 chars) needs no column change. Verify before assuming:

```bash
npx tsx -e "import{neon}from'@neondatabase/serverless';import*as d from'dotenv';d.config({path:'.env'});
neon(process.env.DATABASE_URL)\`SELECT character_maximum_length FROM information_schema.columns WHERE table_name='events' AND column_name='approval_status'\`.then(r=>console.log(r))"
```

- [ ] **Step 2: Apply to BOTH databases**

```bash
npx tsx scripts/apply-sql-file.ts migrations/2026-07-31-submission-edits.sql
npx tsx scripts/apply-sql-file.ts migrations/2026-07-31-submission-edits.sql --test
```
Expected: both report success. **Do not skip the second.**

- [ ] **Step 3: Mirror the columns in `src/lib/db/schema.ts`**

Add `rejectionReason: text("rejection_reason")` and `updatedAt: timestamp("updated_at").defaultNow()` to each of the seven tables.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-07-31-submission-edits.sql src/lib/db/schema.ts
git commit -m "feat(submissions): add rejection_reason and updated_at columns"
```

---

### Task 2: Per-type config table

One place that knows how each type differs, so nothing else has to branch on type.

**Files:**
- Create: `src/lib/submissions/types.ts`
- Test: `tests/unit/submission-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { SUBMISSION_TYPES } from "@/lib/submissions/types";

describe("SUBMISSION_TYPES", () => {
  it("marks simchas as a date-only type and events as an instant", () => {
    expect(SUBMISSION_TYPES.simcha.detailKind).toBe("date");
    expect(SUBMISSION_TYPES.event.detailKind).toBe("instant");
  });

  it("gives every type an owner column and an auto-approve flag", () => {
    for (const [name, cfg] of Object.entries(SUBMISSION_TYPES)) {
      expect(cfg.ownerColumn, name).toBeTruthy();
      expect(cfg.autoApproveField, name).toMatch(/^canAutoApprove/);
    }
  });

  it("does not include types with no submission path or no owner", () => {
    expect(SUBMISSION_TYPES).not.toHaveProperty("special");
    expect(SUBMISSION_TYPES).not.toHaveProperty("shiur");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project unit tests/unit/submission-types.test.ts`
Expected: FAIL — `Cannot find package '@/lib/submissions/types'`.

- [ ] **Step 3: Implement**

```ts
export type SubmissionType =
  | "event" | "simcha" | "classified" | "kosherAlert"
  | "alert" | "shiva" | "tehillim" | "blog";

export interface SubmissionTypeConfig {
  label: string;
  ownerColumn: "userId" | "authorId";
  /** Which formatter the list page must use. Getting this wrong shifts
   *  every date-only row back a day — see src/lib/datetime.ts. */
  detailKind: "instant" | "date";
  autoApproveField: string;
  /** null when the type has no expiry concept, so it is never "past". */
  pastBasis: "startTime" | "shivaEnd" | "expiresAt" | null;
  editPath: (id: number) => string;
}

export const SUBMISSION_TYPES: Record<SubmissionType, SubmissionTypeConfig> = {
  event:       { label: "Event",        ownerColumn: "userId",   detailKind: "instant", autoApproveField: "canAutoApproveEvents",      pastBasis: "startTime", editPath: (id) => `/dashboard/submissions/events/${id}/edit` },
  simcha:      { label: "Simcha",       ownerColumn: "userId",   detailKind: "date",    autoApproveField: "canAutoApproveSimchas",     pastBasis: null,        editPath: (id) => `/dashboard/submissions/simchas/${id}/edit` },
  classified:  { label: "Classified",   ownerColumn: "userId",   detailKind: "instant", autoApproveField: "canAutoApproveClassifieds", pastBasis: "expiresAt", editPath: (id) => `/dashboard/submissions/classifieds/${id}/edit` },
  kosherAlert: { label: "Kosher alert", ownerColumn: "userId",   detailKind: "date",    autoApproveField: "canAutoApproveKosherAlerts",pastBasis: null,        editPath: (id) => `/dashboard/submissions/kosher-alerts/${id}/edit` },
  alert:       { label: "Alert",        ownerColumn: "userId",   detailKind: "instant", autoApproveField: "canAutoApproveAlerts",      pastBasis: "expiresAt", editPath: (id) => `/dashboard/submissions/alerts/${id}/edit` },
  shiva:       { label: "Shiva notice", ownerColumn: "userId",   detailKind: "date",    autoApproveField: "canAutoApproveShiva",       pastBasis: "shivaEnd",  editPath: (id) => `/dashboard/submissions/shiva/${id}/edit` },
  tehillim:    { label: "Tehillim",     ownerColumn: "userId",   detailKind: "date",    autoApproveField: "canAutoApproveTehillim",    pastBasis: "expiresAt", editPath: (id) => `/dashboard/submissions/tehillim/${id}/edit` },
  blog:        { label: "Blog post",    ownerColumn: "authorId", detailKind: "instant", autoApproveField: "canAutoApproveBlog",        pastBasis: null,        editPath: (id) => `/dashboard/blog/${id}/edit` },
};
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project unit tests/unit/submission-types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/submissions/types.ts tests/unit/submission-types.test.ts
git commit -m "feat(submissions): per-type config so nothing else branches on type"
```

---

### Task 3: `resolveApprovalStatus` — the auto-approve fix

**Files:**
- Create: `src/lib/submissions/auto-approve.ts`
- Test: `tests/submission-auto-approve.test.ts` *(integration — reads the users table)*

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";

describe("resolveApprovalStatus", () => {
  it("keeps an ordinary member's new submission pending", async () => {
    expect(await resolveApprovalStatus("event", memberId, "member", null))
      .toBe("pending");
  });

  it("sends an ordinary member's edit of a LIVE item to pending_edit, not pending", async () => {
    // pending_edit is what stops the re-broadcast. This is the whole point.
    expect(await resolveApprovalStatus("event", memberId, "member", "approved"))
      .toBe("pending_edit");
  });

  it("leaves an auto-approver's edit of a live item approved", async () => {
    expect(await resolveApprovalStatus("event", trustedId, "member", "approved"))
      .toBe("approved");
  });

  it("leaves an admin's edit of a live item approved", async () => {
    expect(await resolveApprovalStatus("event", adminId, "admin", "approved"))
      .toBe("approved");
  });
});
```

Create the three users in `beforeAll` with `createTestUser`; note it has silently dropped fields before, so pass `canAutoApproveEvents: true` explicitly and assert it landed.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project integration tests/submission-auto-approve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SUBMISSION_TYPES, type SubmissionType } from "./types";

export type ApprovalStatus = "pending" | "pending_edit" | "approved" | "rejected";

/**
 * Used by BOTH create and edit so they cannot drift.
 *
 * `previousStatus` is null on create. On edit it decides between `approved`
 * (the submitter needs no review) and `pending_edit` (a correction awaiting
 * review — deliberately NOT `pending`, which would re-trigger the
 * subscriber broadcast on re-approval).
 */
export async function resolveApprovalStatus(
  type: SubmissionType,
  userId: number,
  role: string | undefined,
  previousStatus: string | null
): Promise<ApprovalStatus> {
  const field = SUBMISSION_TYPES[type].autoApproveField;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const canAutoApprove =
    role === "admin" || Boolean(user?.[field as keyof typeof user]);

  if (canAutoApprove) return "approved";
  return previousStatus === "approved" ? "pending_edit" : "pending";
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project integration tests/submission-auto-approve.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/submissions/auto-approve.ts tests/submission-auto-approve.test.ts
git commit -m "feat(submissions): shared auto-approve resolution for create and edit"
```

---

### Task 4: `canEditRow` — institutional ownership

**Files:**
- Create: `src/lib/submissions/ownership.ts`
- Test: `tests/submission-ownership.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe("canEditRow", () => {
  it("lets the owner edit", async () => {
    expect(await canEditRow({ userId: ownerId, shulId: null }, ownerId, "member")).toBe(true);
  });

  it("refuses a stranger", async () => {
    expect(await canEditRow({ userId: ownerId, shulId: null }, strangerId, "member")).toBe(false);
  });

  it("treats a NULL owner as unowned — legacy rows are never editable", async () => {
    expect(await canEditRow({ userId: null, shulId: null }, anyoneId, "member")).toBe(false);
  });

  it("lets the CURRENT manager of a linked shul edit someone else's event", async () => {
    // A gabbai leaving must not strand the shul's own event.
    expect(await canEditRow({ userId: departedId, shulId }, newManagerId, "shul")).toBe(true);
  });

  it("does not let a manager of a DIFFERENT shul edit it", async () => {
    expect(await canEditRow({ userId: ownerId, shulId }, otherShulManagerId, "shul")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**
- [ ] **Step 3: Implement**

```ts
import { canUserManageShul } from "@/lib/auth/permissions";

export async function canEditRow(
  row: { userId: number | null; shulId?: number | null },
  userId: number,
  role: string | undefined
): Promise<boolean> {
  if (row.userId !== null && row.userId === userId) return true;
  // Institutional ownership: content attached to a shul belongs to whoever
  // manages that shul now, not whoever happened to post it.
  if (row.shulId != null) return canUserManageShul(userId, row.shulId, role);
  return false;
}
```

- [ ] **Step 4: Run it and watch it pass**
- [ ] **Step 5: Commit**

---

### Task 5: `setApprovalStatus` — the single writer

The most important task in this plan. **~15 call sites currently flip `approval_status` independently.** Anything left off this helper silently notifies nobody, or silently re-broadcasts to thousands.

**Files:**
- Create: `src/lib/submissions/set-approval-status.ts`
- Test: `tests/submission-approval-writer.test.ts`

- [ ] **Step 1: Enumerate every existing writer before writing code**

```bash
grep -rn "approvalStatus:" src/app/api --include=route.ts | grep -v "select" 
```
Write the list into the PR description. Every one must end up calling this helper.

- [ ] **Step 2: Write the failing tests**

```ts
it("broadcasts when a NEW submission is approved", async () => {
  const spy = vi.fn();
  await setApprovalStatus({ type: "event", id, next: "approved", previous: "pending", broadcast: spy });
  expect(spy).toHaveBeenCalledOnce();
});

it("does NOT broadcast when an EDITED submission is re-approved", async () => {
  // The regression that matters: without this, correcting a typo on a shiva
  // notice re-emails a bereavement announcement to the whole community.
  const spy = vi.fn();
  await setApprovalStatus({ type: "shiva", id, next: "approved", previous: "pending_edit", broadcast: spy });
  expect(spy).not.toHaveBeenCalled();
});

it("notifies the submitter on approve and on reject", async () => { /* ... */ });

it("does not fail the approval when the email throws", async () => {
  const boom = vi.fn().mockRejectedValue(new Error("resend down"));
  await expect(setApprovalStatus({ ..., notify: boom })).resolves.toBeDefined();
});
```

- [ ] **Step 3: Run and watch them fail**
- [ ] **Step 4: Implement**

Broadcast fires only on `previous === "pending" && next === "approved"`. Notification fires on any transition into `approved` or `rejected`. Both wrapped in try/catch with a `[NOTIFY]` prefix.

- [ ] **Step 5: Run and watch them pass**
- [ ] **Step 6: Commit**

---

### Task 6: `notifySubmitter` + the two emails

**Files:**
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/email/templates.ts`
- Test: `tests/submission-notify.test.ts`

Notes that will bite you:

- The real signature is `createNotification(payload)` — **one object**, not positional args.
- The in-app `type` must be `content_approved` or `content_rejected`; `dashboard/notifications/page.tsx` switches on those exact strings and falls through to a plain grey bell otherwise.
- Render dates with the formatter matching the type's `detailKind`. `formatInstant` on a date-only type shows it a day early.
- Emails carry the standard footer identification but **no unsubscribe link** — transactional under CASL.
- The rejection fallback when no reason is given must read deliberate, not like a shrug. Suggested: *"Your submission wasn't approved for the community calendar. Reply to this email and we'll explain what needs changing."*

- [ ] **Step 1–5:** test, fail, implement, pass, commit.

---

## Chunk 2: Events

Events already have a list page and a PATCH route. This chunk fixes the two known defects and wires events onto the shared foundations.

### Task 7: Fix the auto-approve defect in the merged code

**Files:**
- Modify: `src/lib/events/edit-submission.ts:88-89`
- Modify: `tests/event-edit.test.ts`

- [ ] **Step 1: Split the existing test so the bug is exposed**

The current test *"sends an approved event back to pending when it is edited"* encodes the bug as correct. Replace with two:

```ts
it("sends an ordinary member's edit of a live event to pending_edit", async () => {
  const result = await applyEventEdit(id, memberId, "member", { title: "x" });
  expect(result.status).toBe("pending_edit");
});

it("leaves an auto-approver's edit of a live event approved", async () => {
  const result = await applyEventEdit(id, trustedId, "member", { title: "x" });
  expect(result.status).toBe("approved");   // fails today
});
```

- [ ] **Step 2: Run and confirm the second fails**

Expected: FAIL — returns `pending`. This proves the test catches the real defect.

- [ ] **Step 3: Route the module through `resolveApprovalStatus`**
- [ ] **Step 4: Run — both pass**
- [ ] **Step 5: Commit**

### Task 8: Concurrency guard

Make the update conditional on the status read, return **409** when zero rows match, and set `updated_at`. Test: an edit racing an approval yields 409, never a silent overwrite.

### Task 9: `detailKind`, `canEdit`, `isPast`, `rejectionReason`

**Files:**
- Modify: `src/app/api/user/submissions/route.ts`
- Modify: `src/app/(dashboard)/dashboard/submissions/page.tsx`

- [ ] Add the four fields to the `Submission` interface; keep `type` a **union**, not `string`.
- [ ] The page branches: `detailKind === "date" ? formatDateOnly(detail) : formatInstant(detail)`.
- [ ] `isPast` per the spec's table; **undated types are never past**, so nothing hides behind the toggle.
- [ ] Past-items toggle.
- [ ] Test: a date-only row renders its stored day, not the day before.

### Task 10: Wire the admin routes onto `setApprovalStatus`

Refactor every site found in Task 5 Step 1. Add the optional reason box to the reject dialog.

- [ ] Test: approving from the shared approvals queue notifies the submitter.
- [ ] Test: approving from the per-type admin page notifies the submitter. *(Different code path — this is the one most likely to be missed.)*

---

## Chunk 3: Remaining types

Types 3–7 are the same shape. For each, in this order — **classifieds, simchas, kosher_alerts, alerts, tehillim, shiva** — repeat this template:

- [ ] `src/lib/<type>/edit-submission.ts` mirroring the events module, using `canEditRow` and `resolveApprovalStatus`
- [ ] `PATCH /api/community/<type>/[id]` mirroring the events route
- [ ] Add the type to the `GET /api/user/submissions` union query
- [ ] Edit page reusing that type's existing public form, given an edit mode
- [ ] Tests: owner edits; stranger 403; NULL owner 403; whitelist blocks owner reassignment; live edit → `pending_edit`; auto-approver stays `approved`

**Shiva carries two extra requirements**, both mandatory:

- [ ] The edit form's warning is stronger and shiva-specific — a notice disappearing mid-shiva is the sharpest form of the unpublish trade-off.
- [ ] An explicit test that re-approving a `pending_edit` shiva notice does **not** call `sendShivaNoticeEmail`.

---

## Chunk 4: Blog

Last, because it changes working code that 3,058 posts depend on.

- [ ] Replace the edit-window rule at `src/app/api/user/blog/[id]/route.ts:120` with the unpublish rule
- [ ] Add blog to the submissions list
- [ ] Decide whether `/dashboard/blog` redirects to the unified list or stays as a filtered view
- [ ] Test: editing an approved post now sets `pending_edit` instead of returning an error

---

## Definition of done

- Every site that writes `approval_status` goes through `setApprovalStatus` — verified by the grep from Task 5 returning only that helper.
- Re-approving an edited item of every type sends no broadcast.
- An auto-approver never self-unpublishes.
- No date-only type renders a day early.
- `npx tsc --noEmit` reports 0 errors; eslint adds no new problems beyond the 8 pre-existing.
- All migrations applied to primary **and** the test branch.
