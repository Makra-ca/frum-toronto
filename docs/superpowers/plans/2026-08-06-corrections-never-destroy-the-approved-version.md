# Corrections Never Destroy The Approved Version — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A submitter correcting their own approved item never takes it off the
site, and an admin rejecting that correction never destroys the published
version.

**Architecture:** One shared `pending_changes` table holds a proposed edit as a
JSON patch beside the live row. `applyEdit` gains a branch: an **approved** row
gets a correction record and is otherwise untouched; anything else keeps today's
in-place overwrite. Approving a correction replays the patch through the
existing `applyEdit` write path; rejecting it discards the record and leaves the
live row exactly as it was.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM on Neon Postgres
(`neon-http`, **no transactions**) · Zod · vitest (`unit` = no DB,
`integration` = `.env.test` branch)

**Spec:** `docs/superpowers/specs/2026-08-05-corrections-never-destroy-the-approved-version-design.md`

---

## Facts verified before writing this plan (2026-08-06)

Re-check anything here that a task depends on; the codebase moved during the
session that produced this plan.

| Fact | Status |
|---|---|
| `SUBMISSION_TYPES` keys | 8: `event simcha classified kosherAlert alert shiva tehillim blog` |
| `applyEdit` overwrites in place | Yes — `src/lib/submissions/apply-edit.ts`, guarded `UPDATE … WHERE approvalStatus = previousStatus` |
| Rows currently in `pending_edit` | **0 across all 8 types** |
| Rows currently `rejected` | **0 across all 8 types** |
| Backfill needed | **No** — clean slate |
| `applyEdit` callers | `src/lib/events/edit-submission.ts`, `src/lib/submissions/edit-route.ts`, `src/app/api/user/blog/[id]/route.ts` |
| Editable field whitelist | `EDITABLE_FIELDS[type]` in **`src/lib/submissions/editable-fields.ts`** |
| ⚠️ Name collision | **TWO** exports are called `EDITABLE_FIELDS`. The one this plan means is `@/lib/submissions/editable-fields` (`Record<SubmissionType, readonly string[]>`). The other, `@/components/admin/approvals/approval-edit-fields`, is the admin queue's form config (`Record<ApprovalType, EditableField[]>`) and is **not** interchangeable. Import the submissions one. |
| Per-type Zod schemas | `SUBMISSION_EDIT_SCHEMAS` in `src/lib/validations/submission-edits.ts` |

**Why zero rows matters:** every existing item is either `pending` (never
published) or `approved` (published, unedited). No row is mid-correction, so the
migration adds a table and nothing else. Do not write a backfill.

---

## File structure

**New**

| File | Responsibility |
|---|---|
| `migrations/2026-08-06-pending-changes.sql` | The table, its constraints and indexes |
| `src/lib/db/schema.ts` *(modify)* | `pendingChanges` Drizzle table |
| `src/lib/submissions/corrections.ts` | Create / fetch / apply / discard a correction. **The only writer of `pending_changes`.** |
| `src/lib/submissions/correction-rules.ts` | Pure decisions: does an edit become a correction? Data only, **must not import `@/lib/db`** |
| `src/app/api/admin/corrections/route.ts` | `GET` the queue |
| `src/app/api/admin/corrections/[id]/route.ts` | `POST` approve / reject |
| `src/app/(admin)/admin/corrections/page.tsx` | Server page |
| `src/app/(admin)/admin/corrections/corrections-client.tsx` | The review screen |
| `src/components/admin/corrections/CorrectionDiff.tsx` | Before/after per field |

**Modified**

| File | Change |
|---|---|
| `src/lib/submissions/apply-edit.ts` | Branch: approved → correction; else today's behaviour |
| `src/app/(dashboard)/dashboard/submissions/page.tsx` | Show "correction awaiting review", offer withdraw |
| `src/app/api/user/submissions/route.ts` | Return each row's pending correction |

**Why `correction-rules.ts` is separate:** `corrections.ts` imports `@/lib/db`,
which throws without `DATABASE_URL`, and the vitest `unit` project runs without
one. A single db import in the rules file would take every unit test touching it
down with it. This has bitten the repo three times
(`SUBMISSION_TYPES.broadcast`, `user-deletion-tables.ts`, and the first draft of
`user-deletion-guards.ts`).

---

## Chunk 1: The table and the pure rules

### Task 1: Migration

**Files:**
- Create: `migrations/2026-08-06-pending-changes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- One correction waiting per item, for the eight SUBMISSION_TYPES.
--
-- The live row is never touched while a correction waits. That is the whole
-- point: today an edit overwrites the approved text AND sets pending_edit, so
-- the item leaves the site, and rejecting strands it holding text the admin
-- just rejected with no earlier version anywhere.
CREATE TABLE IF NOT EXISTS pending_changes (
  id            serial PRIMARY KEY,

  -- Which of the eight types, and which row. NOT a foreign key: eight
  -- different parent tables cannot be referenced by one column, so orphan
  -- cleanup is the application's job (see discardCorrectionsFor).
  entity_type   varchar(20) NOT NULL,
  entity_id     integer     NOT NULL,

  -- The proposed values, keyed by column name. Only keys in
  -- EDITABLE_FIELDS[type] are ever written here.
  changes       jsonb       NOT NULL,

  submitted_by  integer     REFERENCES users(id) ON DELETE SET NULL,
  submitted_at  timestamp   NOT NULL DEFAULT now(),

  reviewed_by   integer     REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   timestamp,
  rejection_reason text,

  status        varchar(20) NOT NULL DEFAULT 'pending',

  CONSTRAINT pending_changes_type_valid CHECK (entity_type IN
    ('event','simcha','classified','kosherAlert','alert','shiva','tehillim','blog')),
  CONSTRAINT pending_changes_status_valid CHECK (status IN
    ('pending','approved','rejected')),
  -- A reviewed row must say who and when; an unreviewed one must not pretend.
  CONSTRAINT pending_changes_review_complete CHECK (
    (status = 'pending' AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

-- At most ONE pending correction per item. Enforced in the database, not just
-- in code: "the newer correction replaces the older" is a rule two concurrent
-- requests would otherwise both satisfy.
CREATE UNIQUE INDEX IF NOT EXISTS pending_changes_one_open_per_entity
  ON pending_changes (entity_type, entity_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS pending_changes_queue
  ON pending_changes (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS pending_changes_submitter
  ON pending_changes (submitted_by, status);
```

- [ ] **Step 2: Apply to BOTH databases**

```bash
npx tsx scripts/apply-sql-file.ts migrations/2026-08-06-pending-changes.sql
npx tsx scripts/apply-sql-file.ts migrations/2026-08-06-pending-changes.sql --test
```

Expected: both print success. **Applying to primary only is a known trap** — it
cost a full red suite the last time (`show_shoutouts`, 2026-07-30).

- [ ] **Step 3: Verify the partial unique index actually bites**

```bash
node -e '
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
(async () => {
  await sql`INSERT INTO pending_changes (entity_type, entity_id, changes) VALUES (${"event"}, -1, ${"{}"}::jsonb)`;
  try {
    await sql`INSERT INTO pending_changes (entity_type, entity_id, changes) VALUES (${"event"}, -1, ${"{}"}::jsonb)`;
    console.log("FAIL: a second pending correction was allowed");
  } catch { console.log("OK: second pending correction rejected"); }
  await sql`DELETE FROM pending_changes WHERE entity_id = -1`;
})();'
```

Expected: `OK: second pending correction rejected`

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-08-06-pending-changes.sql
git commit -m "feat(db): pending_changes table for corrections"
```

---

### Task 2: Drizzle schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add the table, next to the other submission tables**

```ts
export const pendingChanges = pgTable("pending_changes", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  changes: jsonb("changes").notNull(),
  submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
}, (table) => [
  index("pending_changes_queue").on(table.status, table.submittedAt),
  index("pending_changes_submitter").on(table.submittedBy, table.status),
]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(db): pendingChanges in the Drizzle schema"
```

---

### Task 3: The pure rule — when does an edit become a correction?

**Files:**
- Create: `src/lib/submissions/correction-rules.ts`
- Test: `tests/unit/correction-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { shouldBecomeCorrection } from "@/lib/submissions/correction-rules";

describe("shouldBecomeCorrection", () => {
  it("is true only for a live item edited by someone who cannot auto-approve", () => {
    expect(shouldBecomeCorrection({ previousStatus: "approved", canAutoApprove: false })).toBe(true);
  });

  it("is false for an item that is not on the site", () => {
    // Nothing to protect: it is not visible, so overwriting it costs nothing,
    // and a correction to an unreviewed item would mean two reviews for one
    // thing.
    for (const previousStatus of ["pending", "pending_edit", "rejected", null]) {
      expect(shouldBecomeCorrection({ previousStatus, canAutoApprove: false }), String(previousStatus)).toBe(false);
    }
  });

  it("is false for an auto-approver — their edits apply immediately", () => {
    // Matches how their submissions already work.
    expect(shouldBecomeCorrection({ previousStatus: "approved", canAutoApprove: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run --project unit tests/unit/correction-rules.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```ts
/**
 * Does this edit become a correction, or overwrite the row?
 *
 * Pure, and in a module that MUST NOT import `@/lib/db` — that module throws
 * without DATABASE_URL and the vitest `unit` project runs without one.
 */
export interface CorrectionDecision {
  previousStatus: string | null;
  canAutoApprove: boolean;
}

export function shouldBecomeCorrection({
  previousStatus,
  canAutoApprove,
}: CorrectionDecision): boolean {
  // Only a LIVE item is worth protecting. Anything else is not on the site, so
  // overwriting costs nothing — and a correction to an unreviewed item would
  // put two things in the queue for one submission.
  if (previousStatus !== "approved") return false;

  // An auto-approver's edits apply immediately, matching how their
  // submissions already behave.
  return !canAutoApprove;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run --project unit tests/unit/correction-rules.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/submissions/correction-rules.ts tests/unit/correction-rules.test.ts
git commit -m "feat(submissions): the rule for when an edit becomes a correction"
```

---

## Chunk 2: The corrections library

### Task 4: Create and read a correction

**Files:**
- Create: `src/lib/submissions/corrections.ts`
- Test: `tests/corrections-lib.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

const { saveCorrection, getCorrectionFor } = await import("@/lib/submissions/corrections");
const { db } = await import("@/lib/db");
const { events, pendingChanges } = await import("@/lib/db/schema");

const stamp = Date.now();
let userId = 0;
let eventId = 0;

beforeAll(async () => {
  userId = (await createTestUser({ email: `test-corr-${stamp}@frumtoronto.test` })).id;
  [{ id: eventId }] = await db.insert(events).values({
    title: `[TEST] Live Event ${stamp}`,
    startTime: new Date("2031-06-01T18:00:00Z"),
    approvalStatus: "approved",
    isActive: true,
    userId,
  }).returning({ id: events.id });
});

afterAll(async () => {
  await db.delete(pendingChanges).where(eq(pendingChanges.entityId, eventId));
  await db.delete(events).where(eq(events.id, eventId));
  await cleanupTestUsers();
});

describe("saveCorrection", () => {
  it("stores the patch and leaves the live row untouched", async () => {
    await saveCorrection("event", eventId, userId, { title: "[TEST] Corrected" });

    const [live] = await db.select().from(events).where(eq(events.id, eventId));
    // THE point of the whole feature.
    expect(live.title).toBe(`[TEST] Live Event ${stamp}`);
    expect(live.approvalStatus).toBe("approved");

    const pending = await getCorrectionFor("event", eventId);
    expect(pending?.changes).toEqual({ title: "[TEST] Corrected" });
    expect(pending?.status).toBe("pending");
  });

  it("replaces an older waiting correction rather than adding a second", async () => {
    await saveCorrection("event", eventId, userId, { title: "[TEST] Newer" });

    const rows = await db.select().from(pendingChanges)
      .where(eq(pendingChanges.entityId, eventId));
    const open = rows.filter((r) => r.status === "pending");
    expect(open).toHaveLength(1);
    expect(open[0].changes).toEqual({ title: "[TEST] Newer" });
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run --project integration tests/corrections-lib.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pendingChanges } from "@/lib/db/schema";
import type { SubmissionType } from "@/lib/submissions/types";

export interface Correction {
  id: number;
  entityType: SubmissionType;
  entityId: number;
  changes: Record<string, unknown>;
  submittedBy: number | null;
  submittedAt: Date;
  status: string;
}

/**
 * Store a proposed edit beside the live row. The live row is NOT touched.
 *
 * The newer correction replaces the older, matching the one-waiting-correction
 * rule. Implemented as delete-then-insert rather than an upsert because
 * `neon-http` has no transactions: the partial unique index
 * (`… WHERE status = 'pending'`) is what actually guarantees one open row, so a
 * lost race surfaces as a constraint violation rather than a duplicate.
 */
export async function saveCorrection(
  entityType: SubmissionType,
  entityId: number,
  submittedBy: number,
  changes: Record<string, unknown>
): Promise<void> {
  await db.delete(pendingChanges).where(
    and(
      eq(pendingChanges.entityType, entityType),
      eq(pendingChanges.entityId, entityId),
      eq(pendingChanges.status, "pending")
    )
  );

  await db.insert(pendingChanges).values({
    entityType,
    entityId,
    changes,
    submittedBy,
  });
}

export async function getCorrectionFor(
  entityType: SubmissionType,
  entityId: number
): Promise<Correction | null> {
  const [row] = await db.select().from(pendingChanges).where(
    and(
      eq(pendingChanges.entityType, entityType),
      eq(pendingChanges.entityId, entityId),
      eq(pendingChanges.status, "pending")
    )
  ).limit(1);

  return (row as Correction | undefined) ?? null;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run --project integration tests/corrections-lib.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/submissions/corrections.ts tests/corrections-lib.test.ts
git commit -m "feat(submissions): store a correction beside the live row"
```

---

### Task 5: Approve and reject a correction

**Files:**
- Modify: `src/lib/submissions/corrections.ts`
- Test: `tests/corrections-lib.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```ts
describe("approveCorrection", () => {
  it("applies the patch to the live row and keeps it approved", async () => {
    await saveCorrection("event", eventId, userId, { title: "[TEST] Approved Fix" });
    await approveCorrection((await getCorrectionFor("event", eventId))!.id, adminId);

    const [live] = await db.select().from(events).where(eq(events.id, eventId));
    expect(live.title).toBe("[TEST] Approved Fix");
    // Never left the site.
    expect(live.approvalStatus).toBe("approved");
    expect(await getCorrectionFor("event", eventId)).toBeNull();
  });
});

describe("rejectCorrection", () => {
  it("leaves the live row exactly as it was", async () => {
    const before = (await db.select().from(events).where(eq(events.id, eventId)))[0];
    await saveCorrection("event", eventId, userId, { title: "[TEST] Should Not Land" });
    await rejectCorrection((await getCorrectionFor("event", eventId))!.id, adminId, "Not suitable");

    const after = (await db.select().from(events).where(eq(events.id, eventId)))[0];
    // The bug this feature exists to kill: rejecting used to strand the item
    // holding text the admin had just rejected.
    expect(after.title).toBe(before.title);
    expect(after.approvalStatus).toBe("approved");
    expect(await getCorrectionFor("event", eventId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run --project integration tests/corrections-lib.test.ts`
Expected: FAIL — `approveCorrection is not a function`

- [ ] **Step 3: Implement**

```ts
/**
 * Apply a waiting correction to the live row.
 *
 * The status is NOT touched. The row is already `approved` — that is the only
 * state that produces a correction — so `setApprovalStatus` is never called and
 * no broadcast guard is consulted. That is what makes a correction unable to
 * re-announce anything.
 *
 * Two round trips, no transaction (`neon-http` has none). Content first, then
 * the record is closed: a failure between them leaves the correction visibly
 * still pending rather than silently lost.
 */
export async function approveCorrection(
  correctionId: number,
  reviewedBy: number
): Promise<void> {
  const [row] = await db.select().from(pendingChanges)
    .where(eq(pendingChanges.id, correctionId)).limit(1);
  if (!row || row.status !== "pending") return;

  const config = SUBMISSION_TYPES[row.entityType as SubmissionType];
  const table = config.table as AnyTable;

  // Re-filter through the whitelist. The stored patch was filtered on the way
  // in, but re-checking here means a hand-edited row cannot write a column the
  // owner was never allowed to touch.
  const allowed = new Set(EDITABLE_FIELDS[row.entityType as SubmissionType]);
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row.changes as Record<string, unknown>)) {
    if (allowed.has(k)) updates[k] = v;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(table).set(updates).where(eq(table.id, row.entityId));
  }

  await db.update(pendingChanges)
    .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
    .where(eq(pendingChanges.id, correctionId));
}

/** Discard a correction. The live row is not read and not written. */
export async function rejectCorrection(
  correctionId: number,
  reviewedBy: number,
  rejectionReason?: string | null
): Promise<void> {
  await db.update(pendingChanges)
    .set({
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date(),
      rejectionReason: rejectionReason ?? null,
    })
    .where(and(eq(pendingChanges.id, correctionId), eq(pendingChanges.status, "pending")));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run --project integration tests/corrections-lib.test.ts`
Expected: 4 passed

- [ ] **Step 5: Verify the reject test would catch the old behaviour**

Temporarily make `rejectCorrection` also null the live row's title, re-run, and
confirm the test goes **red**. Restore. A regression test that cannot fail on
the broken code is worse than none — this repo has shipped three of those.

- [ ] **Step 6: Commit**

```bash
git add src/lib/submissions/corrections.ts tests/corrections-lib.test.ts
git commit -m "feat(submissions): approve and reject a correction"
```

---

### Task 6: Discard corrections when the parent goes away

**Files:**
- Modify: `src/lib/submissions/corrections.ts`
- Test: `tests/corrections-lib.test.ts` (append)

`entity_type`/`entity_id` cannot be a foreign key — eight parent tables, one
column — so nothing in the database cleans these up. Without this, deleting an
item leaves a correction pointing at a row that no longer exists, and the admin
queue renders a card for a ghost.

- [ ] **Step 1: Write the failing test**

```ts
it("discards corrections when the item itself is deleted", async () => {
  const [tmp] = await db.insert(events).values({
    title: `[TEST] Doomed ${stamp}`, startTime: new Date("2031-07-01T18:00:00Z"),
    approvalStatus: "approved", isActive: true, userId,
  }).returning({ id: events.id });

  await saveCorrection("event", tmp.id, userId, { title: "[TEST] never reviewed" });
  await discardCorrectionsFor("event", tmp.id);

  expect(await getCorrectionFor("event", tmp.id)).toBeNull();
  await db.delete(events).where(eq(events.id, tmp.id));
});
```

- [ ] **Step 2–4:** run (fail) → implement → run (pass)

```ts
/** Called when an item is deleted or unapproved. */
export async function discardCorrectionsFor(
  entityType: SubmissionType,
  entityId: number
): Promise<void> {
  await db.delete(pendingChanges).where(
    and(eq(pendingChanges.entityType, entityType), eq(pendingChanges.entityId, entityId))
  );
}
```

- [ ] **Step 5: Commit**

---

## Chunk 3: Wiring the edit path

### Task 6b: Extract the auto-approve lookup

**Files:**
- Modify: `src/lib/submissions/auto-approve.ts`

`resolveApprovalStatus` computes this inline and Task 7 needs the same answer
*before* calling it. **`userCanAutoApprove` does not exist today** — an earlier
draft of this plan referenced it as though it did.

- [ ] **Step 1: Extract, changing no behaviour**

```ts
/** Admin, or holder of this type's auto-approve flag. */
export async function userCanAutoApprove(
  type: SubmissionType,
  userId: number,
  role: string | undefined
): Promise<boolean> {
  if (role === "admin") return true;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return Boolean(user?.[SUBMISSION_TYPES[type].autoApproveField]);
}
```

- [ ] **Step 2:** Have `resolveApprovalStatus` call it, so there is one
      definition. Note it costs a second user lookup in Task 7's path; that is
      acceptable and can be threaded through later if it shows up.
- [ ] **Step 3:** `npx vitest run --project integration` — no behaviour change,
      so nothing should move
- [ ] **Step 4:** Commit

---

### Task 7: `applyEdit` branches

**Files:**
- Modify: `src/lib/submissions/apply-edit.ts`
- Test: `tests/corrections-apply-edit.test.ts`

This is the load-bearing change. **Do not remove the existing overwrite path** —
it is still correct for every non-approved row.

- [ ] **Step 1: Write the failing test**

```ts
it("an owner editing a LIVE item leaves it live and files a correction", async () => {
  const result = await applyEdit("event", eventId, ownerId, { title: "[TEST] Fix" });

  const [live] = await db.select().from(events).where(eq(events.id, eventId));
  expect(live.title).not.toBe("[TEST] Fix");     // untouched
  expect(live.approvalStatus).toBe("approved");   // still on the site
  expect(result.correctionFiled).toBe(true);

  const pending = await getCorrectionFor("event", eventId);
  expect(pending?.changes).toEqual({ title: "[TEST] Fix" });
});

it("an owner editing a PENDING item still overwrites it directly", async () => {
  // Unchanged behaviour: nothing to protect, and a correction would mean two
  // reviews for one submission.
  await applyEdit("event", pendingEventId, ownerId, { title: "[TEST] Direct" });
  const [row] = await db.select().from(events).where(eq(events.id, pendingEventId));
  expect(row.title).toBe("[TEST] Direct");
  expect(await getCorrectionFor("event", pendingEventId)).toBeNull();
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement the branch**

Insert immediately after `updates` is built and `previousStatus` is read, and
**before** `resolveApprovalStatus` is called:

```ts
  // A live item is never taken down to correct it. The proposed values are
  // stored beside it; the row itself is not written at all.
  //
  // Deliberately before resolveApprovalStatus: that function is what would
  // return `pending_edit`, and a correction must never move the status.
  const canAutoApprove = await userCanAutoApprove(type, userId, role);
  if (shouldBecomeCorrection({ previousStatus, canAutoApprove })) {
    await saveCorrection(type, id, userId, updates);
    return { id, status: previousStatus, wasUnpublished: false, correctionFiled: true };
  }
```

Extend `SubmissionEditResult` with `correctionFiled?: boolean`.

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Run the WHOLE existing submissions suite**

Run: `npx vitest run --project integration`
Expected: no regressions. Pay attention to
`tests/submission-broadcasters.test.ts` and any `pending_edit` assertions —
some will now be unreachable for owners and should be re-pointed at the
auto-approver path rather than deleted.

- [ ] **Step 6: Commit**

---

### Task 8: The shul-manager carve-out still holds

`applyEdit` already has a narrow rule: a shul manager correcting that shul's own
live event keeps it live. Under the new branch that rule is subsumed — a live
item never comes down for anyone — but the test must keep passing, and the
now-dead code should go with a comment saying why.

- [ ] **Step 1:** Read the carve-out in `src/lib/submissions/apply-edit.ts` and
      its coverage in `tests/submission-ownership.test.ts` /
      `tests/shul-manager-role.test.ts` — confirm which file actually asserts
      "a shul manager's edit keeps the shul's live event live" before touching
      anything
- [ ] **Step 2:** Confirm the test still passes with the new branch in place
- [ ] **Step 3:** Delete the carve-out, leaving a comment pointing at the new rule
- [ ] **Step 4:** Re-run; commit

---

## Chunk 4: The admin queue

### Task 9: `GET /api/admin/corrections`

**Files:**
- Create: `src/app/api/admin/corrections/route.ts`
- Test: `tests/admin-corrections-api.test.ts`

Returns each pending correction joined to its live row, so the screen can show
before/after without a second fetch per card.

- [ ] Test → implement → pass → commit (standard cycle)

Guard: `session.user.role !== "admin"` → 401. **Admin only** — no capability
holder gets a correction queue (spec decision).

---

### Task 10: `POST /api/admin/corrections/[id]` — approve / reject

**Files:**
- Create: `src/app/api/admin/corrections/[id]/route.ts`

- [ ] Test the four cases: approve applies; reject leaves the row untouched;
      a non-admin gets 401; an already-reviewed correction is a no-op
- [ ] `logAudit()` on both outcomes — `entityType: "correction"`
- [ ] Commit

---

### Task 11: The review screen

**Files:**
- Create: `src/app/(admin)/admin/corrections/page.tsx`
- Create: `src/app/(admin)/admin/corrections/corrections-client.tsx`
- Create: `src/components/admin/corrections/CorrectionDiff.tsx`
- Modify: `src/components/admin/AdminLayoutClient.tsx` (sidebar entry)

Whole-submission review — approve or reject, optional reason on rejection. The
diff shows every changed field side by side.

- [ ] Build; verify in a browser on the test branch using
      `scripts/set-test-admin-password.mjs` and `scripts/sync-events-to-test.mjs`
- [ ] Commit

---

## Chunk 5: The submitter's side

### Task 12: Dashboard shows a waiting correction

**Files:**
- Modify: `src/app/api/user/submissions/route.ts`
- Modify: `src/app/(dashboard)/dashboard/submissions/page.tsx`

- [ ] Each row gains `pendingCorrection`, so the card can say
      *"Your correction is waiting for review — the published version is still
      showing."* Without this the submitter sees their edit vanish and assumes
      it failed.
- [ ] Offer **Withdraw**, which calls `discardCorrectionsFor`
- [ ] Commit

---

### Task 13: Retire the now-unreachable `pending_edit`

**Files:** five admin filter dropdowns, `ApprovalCard`, `PENDING_STATUSES`, the
dashboard badge.

Nothing will produce `pending_edit` again — creates pass `previousStatus = null`,
so it only ever came from the edit path. The filters that match it become
controls that can never return a row.

- [ ] **Leave `PENDING_STATUSES` alone.** It is defensive and costs nothing.
- [ ] Remove the "Awaiting re-approval" filter *options* only, with a comment
- [ ] Confirm `isPending()` still covers both values
- [ ] Commit

---

## Testing

Beyond each task's own tests, the suite must pin:

- [ ] Editing a live item **never** changes `approval_status`
- [ ] Rejecting a correction leaves the live row byte-identical
- [ ] Two corrections in a row leave exactly **one** pending record
- [ ] An auto-approver's edit still applies immediately, no correction filed
- [ ] Editing a `rejected` item still returns it to `pending` — an auto-approver
      must not overturn an admin's rejection by editing
      (`resolveApprovalStatus` checks `rejected` first, deliberately)
- [ ] Approving a correction does **not** broadcast — `setApprovalStatus` is
      never called on that path
- [ ] Deleting an item discards its corrections

**Verify each of the first three by reinstating the bug and watching the test go
red.** Three regression tests in this repo have passed against broken code.

---

## Risks, carried from the spec

**A correction can wait indefinitely while the wrong version stays live.** For a
classified that is harmless; for a **shiva notice** with a corrected levaya time
it is not. Accepted knowingly — still better than today, where the notice
disappears entirely. Revisit if it bites.

**A shul manager can silently replace a submitter's waiting correction**, since
`canEditRow` returns true for both. One shul manager exists today and it is a
test account.

**Admin edits still leave no trace.** Unchanged, and still an open thread.

---

## Out of scope

- **Businesses.** Not in `SUBMISSION_TYPES`, carries a `pending_payment` status
  the others do not, and its field work is unfinished (`logoUrl` has no write
  path). It joins this table later — see
  `docs/project-memory/decisions/2026-08-05-businesses-join-corrections-later.md`.
- Per-field review. Whole-submission only (spec decision).
- Notifying the submitter when an admin edits their item. Open thread.
