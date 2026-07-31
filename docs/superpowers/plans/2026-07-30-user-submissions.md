# User Submissions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see, edit and hear back about the content they submit, without an edit ever re-broadcasting to the whole subscriber list.

**Architecture:** A new `pending_edit` status distinguishes a correction from a new submission, so broadcast guards can tell them apart. One shared writer (`setApprovalStatus`) owns every approval transition, the broadcast decision and the submitter notification. Per-type modules hold only what genuinely differs.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, NextAuth v5, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-user-submissions-design.md` — read it first.

> **Progress, end of 2026-07-30 (session 2).** Chunk 0 and **all of Chunk 1** are
> done (tasks 1.1–1.8). Next task is **2.1**, the events auto-approve defect.
> Branch `feature/submissions-impl` in the `../ft-subs` worktree; not merged,
> not pushed. Decisions taken in Chunk 1 that later chunks depend on:
>
> - **The broadcast guard needs BOTH halves** — `broadcast_at IS NULL` *and*
>   `previous !== "pending_edit"`. The shiva route-level test caught this: a
>   correction whose stamp is missing (a row approved before the column
>   existed) would otherwise re-announce a bereavement to the whole community.
> - **A create that lands approved broadcasts AND stamps `broadcast_at`.** With
>   the writer's gate that gives at most one broadcast per item, ever — which
>   answers the plan's second open question in 1.7: an auto-approver's *edit*
>   never re-announces. A user pressing Save cannot mass-email the community.
> - **`resolveApprovalStatus` treats an admin as an auto-approver on every
>   type.** This changed behaviour for `community/shiva` and
>   `community/tehillim`, which omitted the `role === "admin"` arm that the
>   other five create routes had.
> - **The kosher-alert broadcast is now `sendKosherAlertBroadcast`** in
>   `lib/email/send.ts`, and `SUBMISSION_TYPES.kosherAlert.broadcast` points at
>   it. Its explicit "Save & Notify" is suppressed when the approval in the same
>   request already announced.
> - **Chunk 0 missed `ApprovalCard.tsx:102`** — the Approve/Reject buttons were
>   still gated on the literal `"pending"`, so a corrected item rendered with no
>   actions. Fixed in 1.8. Worth assuming other Chunk 0 misses exist.
>
> **Not mine, but blocking a clean suite:** `tests/homepage-ads.test.ts >
> rejects a business-linked ad with no business` fails. Verified at the database
> level: **both** primary and the test branch carry the loose version of
> `homepage_ads_link_target_check`, while `migrations/2026-07-30-homepage-ads.sql`
> on disk requires `business_id IS NOT NULL`. So production currently accepts a
> business-linked ad with no business, which renders a dead click. The ads
> session owns this.

**Revision 3.** The first draft was reviewed and found unexecutable: it introduced `pending_edit` without widening the ~53 places that read `"pending"`, so edited items would have vanished from every admin queue. That, and five other critical defects, are fixed here. Where a step exists because a review caught something, the reason is stated inline — do not "simplify" those away.

---

## Before you start

Read, in order:

1. The spec — especially *The broadcast defect that shapes the design*
2. `src/lib/datetime.ts` — the header explains why instants and dates must never share a formatter
3. `src/app/api/admin/content/[type]/[id]/approve/route.ts` — the broadcast this plan works around
4. `src/lib/events/edit-submission.ts` — the module you extend in Chunk 2

**Environment facts that will otherwise waste your time:**

- Every migration runs **twice** — primary, then the Neon test branch:
  ```bash
  npx tsx scripts/apply-sql-file.ts migrations/<file>.sql
  npx tsx scripts/apply-sql-file.ts migrations/<file>.sql --test
  ```
  Skipping `--test` makes every integration test fail with `column ... does not exist`.
- Unit tests are pinned to `TZ=UTC` in `vitest.config.mts` because that is what Vercel runs. Leave it.
- Integration tests need `.env.test`. A burst of `NeonDbError: fetch failed` across unrelated files means the test branch suspended — re-run before investigating.
- **Baseline eslint before you start** (`npx eslint . 2>&1 | tail -3`) and record the number. It is exactly **49 errors** on 2026-07-30 (CLAUDE.md's older figure of 43 is stale). The rule is "add no new problems", not "reach zero".
- Run `npx tsc --noEmit` before every commit.

---

## File structure

| File | Responsibility |
|---|---|
| `migrations/2026-07-31-submission-edits.sql` | `rejection_reason`, `updated_at`, indexes |
| `src/lib/submissions/types.ts` | `SubmissionType` union + per-type config (table, owner col, date kind, broadcaster, auto-approve flag) |
| `src/lib/submissions/statuses.ts` | `PENDING_STATUSES`, `ApprovalStatus` — imported by every queue and schema |
| `src/lib/submissions/ownership.ts` | `canEditRow` — owner OR current shul manager |
| `src/lib/submissions/auto-approve.ts` | `resolveApprovalStatus` — shared by create and edit |
| `src/lib/submissions/set-approval-status.ts` | The single writer |
| `src/lib/submissions/list-query.ts` | The multi-table union behind `GET /api/user/submissions` |
| `src/lib/notifications.ts` | *(modify)* `notifySubmitter`, `notifyAdminOfTrustedEdit` |
| `src/lib/events/edit-submission.ts` | *(modify)* shared helpers; return the resolved status |
| `src/app/api/community/events/[id]/route.ts` | *(modify)* pass `role`; branch copy on resolved status |
| `src/app/api/user/submissions/route.ts` | *(modify)* delegate to `list-query.ts` |
| `src/app/(dashboard)/dashboard/submissions/page.tsx` | *(modify)* `detailKind` branch, past toggle, `pending_edit` chip |

---

## Chunk 0: Make the codebase safe for a new status

**Do this before anything writes `pending_edit`.** Roughly 53 sites and most admin zod enums currently assume the only non-terminal status is the literal `"pending"`. Introduce the new value first and an edited item becomes invisible to admins — off the site, and in no queue.

### Task 0.1: Central status constants

**Files:** Create `src/lib/submissions/statuses.ts`; Test `tests/unit/submission-statuses.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { PENDING_STATUSES, isPending } from "@/lib/submissions/statuses";

it("treats both pending and pending_edit as awaiting review", () => {
  expect(isPending("pending")).toBe(true);
  expect(isPending("pending_edit")).toBe(true);
  expect(isPending("approved")).toBe(false);
});

it("exposes both values for use in SQL inArray()", () => {
  expect([...PENDING_STATUSES].sort()).toEqual(["pending", "pending_edit"]);
});
```

- [ ] **Step 2: Run — expect module-not-found**
- [ ] **Step 3: Implement**

```ts
export const PENDING_STATUSES = ["pending", "pending_edit"] as const;
export type ApprovalStatus = "pending" | "pending_edit" | "approved" | "rejected";
export const isPending = (s: string | null): boolean =>
  (PENDING_STATUSES as readonly string[]).includes(s ?? "");
```

- [ ] **Step 4: Run — pass. Step 5: Commit.**

### Task 0.1b: Close the public leak and make the broadcast guards allowlists

Both are one-liners, both must land before anything can write `pending_edit`.

- [ ] **Public shul pages show events with no approval filter at all.** Verified: `(public)/shuls/[slug]/page.tsx:44` and `api/shuls/slug/[slug]/route.ts:36` filter only on `isActive` + future date. A gabbai edits their shul's event, we tell them it came off the site, and it stays visible. (Nothing is leaking today — zero matching rows — but this is a pre-existing hole regardless of this feature.) Add `eq(events.approvalStatus, "approved")` to both. Lesser sibling: `api/events/organizations/route.ts:22-26`, the public typeahead, leaks organisation names from unapproved events.

- [ ] **All four broadcast guards are denylists (`previous !== "approved"`), which `pending_edit` satisfies.** Rewrite each to the allowlist form `previous === "pending" && next === "approved"`:

  | File | Broadcaster |
  |---|---|
  | `admin/content/[type]/[id]/approve/route.ts:71` | `sendEventLiveEmail` |
  | `admin/events/[id]/route.ts:99-104` | `sendEventLiveEmail` — **the admin event-edit route, missed by earlier drafts** |
  | `admin/kosher-alerts/[id]/route.ts:84-96` | `resend.batch.send` |
  | `admin/shiva/[id]/route.ts:161-167` | `sendShivaNoticeEmail` |

- [ ] **Test each guard at route level** with the pattern from Task 1.5 — including a **positive control**, or an implementation that never broadcasts passes every one.

### Task 0.1c: Make `alerts` approvable at all

`admin/alerts/[id]/route.ts:8-16` has **no `approvalStatus` field in its PATCH schema**, and the shared approve route's `tableMap` (`admin/content/[type]/[id]/approve/route.ts:8-13`) covers only `simchas, classifieds, events, tehillim` — not `alerts`, `kosher_alerts`, `shiva` or `blog`.

- [ ] Add `approvalStatus` to the alerts PATCH schema, and add the four missing tables to `tableMap` — or state per type how it gets approved. Without this an edited alert is unapprovable and permanently off the public page.

### Task 0.2: Widen every reader

- [ ] **Step 1: Enumerate.** Grep **all of `src/`** — `src/components` holds the real approvals UI and an earlier draft of this plan missed it entirely:

```bash
grep -rn 'approvalStatus, "pending"\|approvalStatus === "pending"\|status === "pending"' src/ --include=*.ts --include=*.tsx
```
Expected on 2026-07-30: **~53 hits** (35 under `src/app src/lib` alone). Record the list in the PR body. Sites an earlier draft missed, all of which strand a `pending_edit` row:

- `src/components/admin/ContentApprovalTabs.tsx:127,130,133` — tab **counts**
- `src/components/admin/ContentApprovalTabs.tsx:175,265,361` and `ApprovalCard.tsx:102` — the quick Approve/Reject buttons, so a `pending_edit` row appears with **no actions on it**
- `src/app/(dashboard)/dashboard/blog/page.tsx:141` and `blog/[id]/edit/page.tsx:68-69` — client gates that lock the *owner* out of their own post
- `src/types/index.ts:3` — a pre-existing `ApprovalStatus` union of three members. Reconcile with the new one; do not create a second competing definition.
- `src/app/api/cron/notification-digest/route.ts:53-75` — nine counts; edited items would never appear in your daily digest

- [ ] **Step 2: Replace — but NOT everywhere.**

> **Do not blanket-replace.** Roughly nine of the hits are `approvalStatus === "pending" ? "pending" : "auto_approved"` notification payloads, and — critically — **the broadcast guards must keep distinguishing `pending` from `pending_edit`.** That distinction is the entire mechanism. Widening a broadcast guard to `isPending(...)` restores the mass-email bug while every test still passes.
>
> Rule: widen anything that answers *"does an admin still need to look at this?"* Leave alone anything that answers *"was this newly submitted?"*

Widen queue filters, counts, badges and action-button gates. Leave broadcast guards and notification-payload ternaries.
- [ ] **Step 3: Widen every admin zod enum.** `z.enum(["pending","approved","rejected"])` → add `"pending_edit"`. Actual sites (8, verified): `admin/blog/comments/[id]`, `admin/classifieds/[id]`, `admin/shiva/[id]`, `admin/rabbi-submissions/[id]` *(a different enum — leave it)*, `admin/simchas/[id]`, `admin/kosher-alerts/route.ts`, `admin/tehillim/[id]`, `admin/kosher-alerts/[id]`. **There is no approvalStatus enum for events** (`admin/events/[id]/route.ts:65` destructures it off the raw body, unvalidated) and **none at all for alerts** — see Task 0.1c. Find them:

```bash
grep -rn 'z.enum(\["pending"' src/app/api/admin/
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` is clean, and every remaining literal `"pending"` comparison is one you deliberately kept per the Step 2 rule — list them in the PR body with a one-line reason each. A zero result is **not** the target and is not achievable.
- [ ] **Step 5: Commit** — `"refactor(admin): treat pending_edit as awaiting review everywhere"`

*No behaviour changes yet — `pending_edit` is simply now understood everywhere.*

---

## Chunk 1: Shared foundations

### Task 1.1: Migration

**Files:** Create `migrations/2026-07-31-submission-edits.sql`

- [ ] **Step 1: Write it.** Eight tables get `rejection_reason` (**including `blog_posts`** — it is in scope in Chunk 4). Seven get `updated_at`; **`blog_posts` already has one.** All eight get an index, because queue ordering is the whole reason the column exists.

> **`broadcast_at` is the real fix, not `pending_edit` alone.** A transition-only rule is defeated by
> `approved (broadcast) → edit → pending_edit → admin rejects → edit again → pending → approve` — which
> broadcasts a second time. `rejected` erases the fact that the row was ever published. A broadcast is a
> fact about the **row**, not about a transition, so gate on `broadcastAt === null` and stamp it when it
> fires. `pending_edit` then becomes defence in depth rather than the sole guard.

```sql
ALTER TABLE events              ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
-- ... same for the other seven

ALTER TABLE events              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE blog_posts          ADD COLUMN IF NOT EXISTS rejection_reason text;

-- blog_posts already has updated_at; the other seven do not.
ALTER TABLE events              ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
-- ... same for simchas, classifieds, kosher_alerts, alerts, shiva_notifications, tehillim_list

CREATE INDEX IF NOT EXISTS idx_events_updated ON events (updated_at DESC);
-- ... one per table, all eight
```

`approval_status` is `varchar(20)` with no CHECK constraint on any table (verified), so `pending_edit` needs no column change.

- [ ] **Step 2: Apply to BOTH databases.**
- [ ] **Step 3: Mirror in `src/lib/db/schema.ts` — with `$onUpdate`.**

> **A `DEFAULT now()` column never changes after insert.** The schema currently has **zero** `$onUpdate` uses across 17 `updatedAt` columns, so every one of them is frozen at creation. If you copy that pattern, ordering queues by `updated_at` is identical to `created_at` and the concurrency guard compares two values that never move — both features silently do nothing.

```ts
updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
```

- [ ] **Step 4: Prove it updates — table-driven, and not against the insert value.** The insert stamp comes
      from Postgres `now()` (Neon's clock) while `$onUpdate` uses your machine's, so `after > before` is
      flaky in both directions from clock skew. Compare **two update values** instead, and drive it over
      `SUBMISSION_TYPES` — testing one table lets you forget `$onUpdate` on the other six and nothing fails,
      which is the exact inert-column failure this task exists to prevent. Integration project.
- [ ] **Step 5:** `npx tsc --noEmit`, then commit.

### Task 1.2: Per-type config

**Files:** Create `src/lib/submissions/types.ts`; Test `tests/unit/submission-types.test.ts`

The config must carry everything type-specific, or `setApprovalStatus` cannot be written: the Drizzle table, the broadcaster, the date kind, and the past rule.

- [ ] **Step 1: Write the failing test.** Assert real behaviour, not the shape of a literal:

```ts
it("pairs each type's detail column with the right formatter kind", () => {
  // simchas.event_date is a DATE; events.start_time is a timestamp.
  // Getting this backwards renders every simcha a day early.
  expect(SUBMISSION_TYPES.simcha.detailKind).toBe("date");
  expect(SUBMISSION_TYPES.event.detailKind).toBe("instant");
});

it("gives every type a Drizzle table and a resolvable owner column", () => {
  for (const [name, cfg] of Object.entries(SUBMISSION_TYPES)) {
    expect(cfg.table, name).toBeDefined();
    expect(getTableColumns(cfg.table)[cfg.ownerColumn], name).toBeDefined();  // PgTable has no index signature
  }
});

it("exempts permanent tehillim entries from ever being past", () => {
  expect(SUBMISSION_TYPES.tehillim.pastExemptField).toBe("isPermanent");
});
```

*(Do not write `expect(SUBMISSION_TYPES).not.toHaveProperty("special")` — it passes for an empty object and can never regress.)*

- [ ] **Step 2: Run — fail. Step 3: Implement.**

```ts
import { events, simchas, classifieds, kosherAlerts, alerts,
         shivaNotifications, tehillimList, blogPosts, users } from "@/lib/db/schema";

export interface SubmissionTypeConfig {
  label: string;
  table: PgTable;
  ownerColumn: "userId" | "authorId";
  titleColumn: string;
  /** The column shown as `detail`, and how it must be formatted. */
  detailColumn: string;
  detailKind: "instant" | "date";
  /** Typed so a typo fails to compile rather than silently never auto-approving. */
  autoApproveField: keyof typeof users.$inferSelect;
  pastBasis: string | null;          // null ⇒ never past
  pastBasisKind: "instant" | "date";
  pastExemptField?: string;          // e.g. isPermanent
  /** null ⇒ approving this type broadcasts to nobody. */
  broadcast: ((row: unknown) => Promise<void>) | null;
  editPath: (id: number) => string;
}
```

Fill all eight. `detailColumn` is **required and explicit** — an engineer must never have to infer which column `detail` shows, because inferring wrong on a DATE type is the day-early bug.

- [ ] **Step 4: Run — pass. Step 5: Commit.**

### Task 1.3: `resolveApprovalStatus`

**Files:** Create `src/lib/submissions/auto-approve.ts`; Test `tests/submission-auto-approve.test.ts`

- [ ] **Step 1: Write the failing tests.** Four of these exist because a review caught the logic wrong:

```ts
it("keeps an ordinary member's new submission pending", ...);          // → "pending"
it("sends a member's edit of a LIVE item to pending_edit", ...);       // → "pending_edit"

it("KEEPS pending_edit on a second edit before review", async () => {
  // The first draft returned "pending" here, because previousStatus was no
  // longer "approved". Approving that fires the pending→approved broadcast —
  // so pressing Save twice re-emailed the whole community.
  expect(await resolveApprovalStatus("event", memberId, "member", "pending_edit"))
    .toBe("pending_edit");
});

it("does NOT let an auto-approver silently republish rejected content", async () => {
  // Otherwise a trusted user overrides an admin's rejection by editing.
  expect(await resolveApprovalStatus("event", trustedId, "member", "rejected"))
    .toBe("pending");
});

it("leaves an auto-approver's edit of a live item approved", ...);     // → "approved"
it("leaves an admin's edit of a live item approved", ...);             // → "approved"
```

- [ ] **Step 2: Extend `createTestUser` first.** `tests/utils/test-db.ts:38-68` whitelists only seven `canAutoApprove*` fields — **five of the twelve are missing** — `canAutoApproveAskTheRabbi`, `canAutoApproveShuls`, `canAutoApproveShiurim`, `canAutoApproveAlerts`, `canAutoApproveBlog` — so a test asking for one gets a user without the flag and then passes for the wrong reason. Add all twelve, and have each auto-approver test assert the flag landed on the returned row.
- [ ] **Step 3: Run — fail. Step 4: Implement.**

```ts
export async function resolveApprovalStatus(
  type: SubmissionType, userId: number, role: string | undefined,
  previousStatus: string | null
): Promise<ApprovalStatus> {
  // A rejection is an admin decision; editing must not overturn it.
  if (previousStatus === "rejected") return "pending";

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const canAutoApprove = role === "admin" ||
    Boolean(user?.[SUBMISSION_TYPES[type].autoApproveField]);
  if (canAutoApprove) return "approved";

  // pending_edit is sticky — a second edit must not decay to "pending".
  return previousStatus === "approved" || previousStatus === "pending_edit"
    ? "pending_edit"
    : "pending";
}
```

- [ ] **Step 5: Run — pass. Step 6: Commit.**

### Task 1.4: `canEditRow`

**Files:** Create `src/lib/submissions/ownership.ts`; Test `tests/submission-ownership.test.ts`

Tests: owner edits; stranger 403; **NULL owner is never editable**; current manager of the linked shul may edit someone else's event; a manager of a *different* shul may not.

`canUserManageShul(userId: number, shulId: number, userRole: string)` takes a **required** `string` (`src/lib/auth/permissions.ts:11-15`). Passing `role: string | undefined` straight through does not compile — use `role ?? ""`.

### Task 1.5: `setApprovalStatus` — the single writer

The most important task here. **Anything left off this helper silently notifies nobody, or silently re-broadcasts to thousands.**

- [ ] **Step 1: Enumerate every writer.** The obvious grep misses the ones that matter — `admin/shiva/[id]/route.ts:146` writes `updates.approvalStatus = ...` (no colon) and `admin/kosher-alerts/[id]` writes via `.set(result.data)`, where the status never appears literally. Both carry live broadcast guards. Use all three:

```bash
grep -rnE 'approvalStatus\s*[:=]' src/app --include=*.ts --include=*.tsx
grep -rn '\.set(' src/app/api/admin --include=route.ts
grep -rn 'sendEventLiveEmail\|sendShivaNoticeEmail\|resend.batch' src/app src/lib
```
The third finds broadcast guards directly, which is the safer index. Record every hit; each must end up routed through the helper.

- [ ] **Step 2: Write the failing tests — at route level, and read this before you do.**

> The obvious version of this test **passes with the bug fully present.** `admin/shiva/[id]/route.ts:35`
> returns 401 before touching the database, so with no session mocked the route bails, nothing is approved,
> no email is attempted, and `expect(...).not.toHaveBeenCalled()` is trivially true. Four more traps:
> `vi.mock` inside `it()` is **not hoisted** (the route already captured the real module); a factory mock
> replaces every export of `@/lib/email/send`, so use `importOriginal`; the file must live in `tests/`
> (integration) because `src/lib/db/index.ts:5` throws without `DATABASE_URL`; and the community routes call
> `revalidatePath`, which throws outside a request context, so `next/cache` needs mocking too — no existing
> test in this repo does that, so there is no pattern to copy.

`tests/shiva-broadcast-guard.test.ts`:

```ts
const mocks = vi.hoisted(() => ({
  session: { user: { id: "1", role: "admin" } },
  sendShivaNoticeEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendShivaNoticeEmail: mocks.sendShivaNoticeEmail,
}));
import { PATCH } from "@/app/api/admin/shiva/[id]/route";

it("does NOT broadcast when an edited notice is re-approved", async () => {
  const id = await makeShiva("pending_edit");
  mocks.sendShivaNoticeEmail.mockClear();

  const res = await approve(id);

  expect(res.status).toBe(200);                        // proves auth + zod let us through
  const [row] = await db.select().from(shivaNotifications).where(eq(shivaNotifications.id, id));
  expect(row.approvalStatus).toBe("approved");         // proves the approval actually happened
  expect(mocks.sendShivaNoticeEmail).not.toHaveBeenCalled();
});

it("DOES broadcast on a first approval (pending → approved)", async () => {
  const id = await makeShiva("pending");
  mocks.sendShivaNoticeEmail.mockClear();
  expect((await approve(id)).status).toBe(200);
  expect(mocks.sendShivaNoticeEmail).toHaveBeenCalledTimes(1);   // positive control
});

it("does NOT broadcast after TWO edits then an approval", async () => {
  // The composed path. Task 1.3 tests the helper; this tests the outcome.
});
```

The `expect(res.status).toBe(200)` is also the only thing in the plan that catches a **missed zod widening**
from Task 0.2.

- [ ] **Step 2b: Add the tests Task 0.2 has none of.** A 53-site refactor verified only by grep and `tsc`
      catches nothing — a leftover `eq(x, "pending")` and an un-widened `z.enum` both still compile.
      `tests/pending-edit-visibility.test.ts`: assert a `pending_edit` row you created appears in the queue
      query (assert on **the id you created**, never a count), and an `it.each` over the enumerated admin
      routes asserting each accepts `pending_edit` without a 400.

- [ ] **Steps 3–6:** fail, implement, pass, commit. Broadcast fires when `next === "approved" &&
      row.broadcastAt === null`, stamping `broadcastAt`. Notification fires on any transition into `approved`
      or `rejected`. Both try/caught with a `[NOTIFY]` prefix — and test that a thrown email does not fail
      the approval.

### Task 1.6: `notifySubmitter` + `notifyAdminOfTrustedEdit` + emails

- `createNotification(payload)` takes **one object**, not positional args.
- In-app `type` must be `content_approved` or `content_rejected` — `dashboard/notifications/page.tsx:48,50` switches on those exact strings.
- **`notifyAdminOfTrustedEdit`** is required by the spec (the mitigation for letting auto-approvers' edits stay live): in-app only, no email, fired when an auto-approver edits already-public content.
- Render dates with the formatter matching the type's `detailKind`.
- Emails: standard footer identification, **no unsubscribe link** (transactional under CASL).
- Rejection fallback when blank: *"Your submission wasn't approved for the community calendar. Reply to this email and we'll explain what needs changing."*

---

### Task 1.7: Route the CREATE paths through the shared helper

The spec's reason for a shared helper is that create and edit "cannot drift". Building it and wiring only
the edit path leaves one caller and no guarantee.

- [ ] Route each type's POST handler (`community/events/route.ts:83-90` and equivalents) through
      `resolveApprovalStatus(type, userId, role, null)`.
- [ ] **Decide the create-broadcast rule.** The spec's state machine says an auto-approver's *create*
      broadcasts, but `previous === "pending" && next === "approved"` is false for a create (no previous).
      With `broadcast_at` this resolves cleanly: broadcast when `next === "approved" && broadcastAt === null`.
      State it explicitly and test it.
- [ ] **Decide whether an auto-approver's *edit* may broadcast.** `pending → approved` from a user-facing
      route means a user pressing Save mass-emails the community with no admin in the loop. With
      `broadcast_at` this collapses to "at most one broadcast per item, ever" — almost certainly what you
      want. Record the decision.

### Task 1.8: Order the admin queues by `updated_at`

The column and its index exist for exactly this and nothing writes an `ORDER BY`. Without it an edited 2023
simcha sits under 16,000 rows and the feature is unusable in the case it was built for.

- [ ] Change the ordering in `admin/approvals/page.tsx` and every per-type admin queue.
- [ ] Make corrections **distinguishable** from new submissions in the queue (a badge or filter) — the spec
      calls this out as something `pending_edit` earns.
- [ ] Add `pending_edit` ("Awaiting re-approval") to every admin filter and edit-dialog `<Select>` — e.g.
      `admin/community/shiva/page.tsx:407-410,800-802`, and the same block in simchas, tehillim,
      classifieds, blog, kosher-alerts. Widen the three-member TS unions alongside them, including the
      pre-existing `src/types/index.ts:3`.

## Chunk 2: Events

### Task 2.1: Fix the auto-approve defect

**Files:** Modify `src/lib/events/edit-submission.ts` (the defect is at **lines 92-93**), `src/app/api/community/events/[id]/route.ts` (**the only caller — it must be updated in the same commit or `tsc` fails**), `tests/event-edit.test.ts`

- [ ] **Step 1: Change `EventEditResult` to return the resolved status.** It currently returns `{ id, wasUnpublished }` with no `status` field, so a test asserting `result.status` fails as `undefined`, not as a wrong value.
- [ ] **Step 2: Split the existing test.** The current *"sends an approved event back to pending"* encodes the bug as correct — replace with a member case (`pending_edit`) and an auto-approver case (`approved`). Expect the auto-approver case to fail with `expected undefined to be "approved"` **after** the signature compiles.
- [ ] **Step 3:** route through `resolveApprovalStatus`; add `role` to the signature and pass `session.user.role` from the route.
- [ ] **Step 4: Fix the now-stale user-facing copy.** `route.ts:105-107` picks its message from `wasUnpublished` (and the `notifyAdminOfSubmission` body at `:91-93` does too), so a trusted user would still be told their event was removed. Branch on the resolved status instead. Same for the `notifyAdminOfSubmission` body.
- [ ] **Step 5:** run, pass, commit.

### Task 2.2: Concurrency guard

Update conditionally on the status read; return **409** on zero rows; set `updatedAt`. Test: an edit racing an approval yields 409, never a silent overwrite.

### Task 2.3: Ownership parity on GET

`GET /api/community/events/[id]:39` still uses an owner-only check while PATCH gains `canEditRow`. A shul manager would get 403 loading a form they are allowed to save. Wire both to `canEditRow`.

### Task 2.4: List API + page

- [ ] `Submission` gains `detailKind`, `canEdit`, `isPast`, `rejectionReason`; `type` stays a **union**, not `string`.
- [ ] **Define `canEdit`** — the spec requires it but never states the rule. Decide and write it down; default proposal: `canEdit = canEditRow(...)` and the item is not past. Get this confirmed before building.
- [ ] Page branches on `detailKind` between `formatDateOnly` and `formatInstant`.
- [ ] `STATUS_STYLES` gains a **`pending_edit`** entry — "Awaiting re-approval". (It will not crash without one: `page.tsx:73-76` already falls back to a grey badge showing the raw string. Still wrong to ship.) Drive the test from the constants so adding a status forces a style: `expect(Object.keys(STATUS_STYLES).sort()).toEqual([...PENDING_STATUSES, "approved", "rejected"].sort())`.
- [ ] Rejected rows show the reason and an "Edit & resubmit" action.
- [ ] Past toggle; undated types are never past.

*The "date-only renders its stored day" test belongs in Chunk 3 — every Chunk 2 type is an instant.*

### Task 2.5: Admin reason box

Rejection happens via `admin/content/[type]/[id]/reject/route.ts` **and** per-type PATCH routes with their own dialogs. Enumerate them; add `rejectionReason` to each request schema and write path. One dialog is not enough.

---

## Chunk 3: The union query, then the remaining types

### Task 3.1: `list-query.ts` — the multi-table union

**This is the largest single piece of work in the plan and the first draft had no task for it.** `GET /api/user/submissions` is currently a single `db.select()` from `events` with `type: "event"` hardcoded. Building the aggregation across eight tables with heterogeneous title/detail columns, plus a stable cross-table sort and paging, is its own task.

Drive it from `SUBMISSION_TYPES` so adding a type is config, not code. Test: returns only the caller's rows; never another user's; sort is stable across types.

### Task 3.2–3.7: Per type

In order — **classifieds, simchas, kosher_alerts, alerts, tehillim, shiva** — repeat:

- [ ] `src/lib/<type>/edit-submission.ts` using `canEditRow` and `resolveApprovalStatus`
- [ ] `PATCH /api/community/<type>/[id]` — with **all six mandatory steps** from the spec, including
      `assertCanPost` (the verified-and-not-blocked gate, absent from earlier drafts entirely) and the
      **conditional write + 409** concurrency guard
- [ ] Wire `notifyAdminOfTrustedEdit` for the auto-approver-edits-live-content case
- [ ] Register the type in `list-query.ts`
- [ ] An edit page, **with the unpublish warning** — the spec's sole mitigation for its headline accepted cost
- [ ] Tests: owner edits; stranger 403; NULL owner 403; **unverified user 403; blocked user 403**;
      whitelist blocks owner reassignment; live edit → `pending_edit`; second edit stays `pending_edit`;
      auto-approver stays `approved`; **shul-manager may edit where the type has a `shul_id`**;
      **409 on a stale write**; **route-level broadcast pair (negative + positive control)** for types that
      have a broadcaster

> **Sizing warning.** Shiva, kosher alerts, simchas and alerts submit through **modals** (`ShivaSubmitModal`, `KosherAlertSubmitModal`, `SimchaSubmitModal`, `AlertSubmitModal`), so "reuse the existing form" means lifting four modals into routed pages. Classifieds is fine — `src/app/classifieds/new/page.tsx` is an existing 453-line routed form. Budget for the four modals, not five.

**Simchas additionally:** the first `detailKind: "date"` type. Do **not** write
`expect(formatDateOnly("2027-06-22")).toBe("June 22, 2027")` — that already exists at
`tests/unit/datetime.test.ts:69` and passes today. The bug is not in `formatDateOnly`; it is the page
choosing the wrong formatter. Extract `formatDetail(value, kind)` and test the branch, plus a
config-vs-schema check that validates all eight types automatically:

```ts
it("detailKind matches the real column type for every type", () => {
  for (const [name, cfg] of Object.entries(SUBMISSION_TYPES)) {
    const col = getTableColumns(cfg.table)[cfg.detailColumn];
    expect(col, `${name}.${cfg.detailColumn} does not exist`).toBeDefined();
    expect(cfg.detailKind).toBe(col.columnType === "PgDate" ? "date" : "instant");
  }
});
```

**Shiva additionally, both mandatory:** a stronger, shiva-specific warning on the edit form; and the route-level test that re-approving a `pending_edit` notice does not call `sendShivaNoticeEmail`.

---

## Chunk 4: Blog

> Blog must satisfy **every** requirement the other types do — `assertCanPost`, `canEditRow`,
> `resolveApprovalStatus`, `setApprovalStatus`, the field whitelist, the 409 guard, the unpublish warning.
> Read this chunk as the per-type template plus the items below, not as four bullets.

- [ ] Replace the status restriction at `src/app/api/user/blog/[id]/route.ts:120` (it is a *status* rule, not
      a time window) with the unpublish rule
- [ ] **Fix the two client gates that also block editing** — `dashboard/blog/page.tsx:141` and
      `dashboard/blog/[id]/edit/page.tsx:68-69` ("Only pending or rejected posts can be edited"). Changing
      only the API leaves the owner locked out of their own `pending_edit` post.
- [ ] **Add `$onUpdate` to `blog_posts.updatedAt`.** It is exempt from the migration because the column
      already exists — it is *not* exempt from being inert.
- [ ] Register blog in `list-query.ts`
- [ ] Decide whether `/dashboard/blog` redirects to the unified list or stays a filtered view
- [ ] Test: editing an approved post sets `pending_edit` instead of erroring

---

## Definition of done

- [ ] `grep -rnE 'approvalStatus\s*[:=]' src/app` shows no write outside `setApprovalStatus` — check by hand; a zero-line grep result is also what a typo produces.
- [ ] Re-approving an edited item of every type sends no broadcast, proven **at route level**.
- [ ] Editing twice then approving sends no broadcast.
- [ ] An auto-approver never self-unpublishes, and never republishes rejected content.
- [ ] `updated_at` demonstrably changes on update.
- [ ] No date-only type renders a day early.
- [ ] `npx tsc --noEmit` clean; eslint adds nothing beyond the recorded baseline.
- [ ] Migrations applied to primary **and** the test branch.
- [ ] Every broadcast test has a **positive control** — an implementation that never broadcasts must fail.
- [ ] Every new integration file cleans up **by the ids it created**, before `cleanupTestUsers()`. The
      content tables reference `users.id` with no `onDelete`, so a leftover row makes the *next* file's
      cleanup throw a foreign-key error and unrelated suites go red.
- [ ] No test asserts over the whole `test-%@frumtoronto.test` set.
