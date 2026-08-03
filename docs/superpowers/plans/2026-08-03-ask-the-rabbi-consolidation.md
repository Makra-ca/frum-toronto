# Ask the Rabbi Management Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both the admin and the one non-admin Ask the Rabbi manager the same four working screens, from one set of components, and fix two live bugs in the Quick Publish composer along the way.

**Architecture:** Four screens move into `src/components/ask-the-rabbi/manage/`. Two thin shells — the admin Programs tab and the dashboard page — each render the same four tabs. The five `rabbi-submissions` API handlers are re-gated from `role === "admin"` to the shared Ask the Rabbi capability check, because the submissions screen is the whole point and it currently 401s for the non-admin manager.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres, Zod, vitest (`unit` and `integration` projects), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-03-ask-the-rabbi-management-consolidation-design.md`

**Revision 2** — corrected after plan review. Two critical defects were found in revision 1: the guard
replacement broke type narrowing, and the new permission helper had a signature that would silently deny
everyone if called the way the existing one is. Both regression tests were also rewritten because neither
could fail against the current code.

---

## Context an engineer new to this codebase needs

**Two people use these screens.** `admin@…` (id 2, role `admin`) and `rabbi.bartfeld@frumtoronto.com`
(id 7, role `member`, `can_manage_ask_the_rabbi = true`). Rabbi Bartfeld is blocked from `/admin` by
middleware (`src/lib/auth/auth.config.ts:17`) *and* by the admin layout (`(admin)/admin/layout.tsx:18-20`).
That is why a second, non-admin shell exists and must keep existing.

**Two guard styles are in play.** Most Ask the Rabbi routes call a local `isAuthorized(session)` that
accepts `role === "admin" || canManageAskTheRabbi`. The `rabbi-submissions` routes check
`role === "admin"` only. Task 1 unifies them. Do not "simplify" any route to an admin-only check.

**The guard also does type narrowing.** `if (!session?.user || …)` is the only thing that narrows `session`
to non-null, and both `rabbi-submissions` files dereference `session.user.id` afterwards
(`route.ts:167`, `[id]/route.ts:80`). Any replacement guard must keep the `!session?.user` clause or `tsc`
fails. Task 1 spells this out.

**Test projects are separate.** `npm run test:unit` needs no database. `npm run test:integration` needs
`.env.test` pointing at the Neon test branch and runs files matching `tests/*.test.ts` (not nested).
Integration files run sequentially (`fileParallelism: false`).

**Route-level tests use hoisted `vi.mock` + dynamic import.** The house pattern, e.g.
`tests/blog-admin-status.test.ts:16-24`:

```ts
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));
const { POST } = await import("@/app/api/…/route");
```

`vi.mock` inside `it()` is **not** hoisted and will not work. Admin routes 401 before touching the
database, so a route test without a mocked `auth()` passes against completely broken code.

**`createTestUser` silently drops fields it does not whitelist.** It covers all twelve `canAutoApprove*`
columns but **not** `canManageAskTheRabbi`. Task 1 adds it. Without that, a permission test passes for the
wrong reason.

**Dates: never use `new Date("2026-08-03")`.** That parses as UTC midnight and renders as the previous day
in `America/Toronto` — verified: `formatInstant(new Date("2026-08-03"))` → `"8/2/2026"`. Use
`fromDateTimeInputs(dateValue)` from `src/lib/datetime.ts`, which returns
`"2026-08-03T16:00:00.000Z"` — Toronto noon. The unit project is pinned to `TZ=UTC` so this reproduces.

**Run `tsc` before every commit.** Drizzle silently ignores unknown keys in `.values()`, so a typo'd column
name is invisible at runtime and only `npx tsc --noEmit` catches it.

**The eslint baseline is 49 errors and 186 warnings** (measured 2026-08-03, before this work). "No worse
than baseline" means that exact count — do not fix the other 49.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/auth/atr-permissions.ts` | The single Ask the Rabbi capability check |
| `src/components/ask-the-rabbi/manage/atr-tabs.ts` | Tab slugs + `parseAtrTab`. **Plain TS, no React imports** |
| `src/components/ask-the-rabbi/manage/SubmissionsInbox.tsx` | Submissions list + answer dialog |
| `src/components/ask-the-rabbi/manage/QuestionsLibrary.tsx` | Published Q&A table, search, publish toggle, delete |
| `src/components/ask-the-rabbi/manage/QuestionEditDialog.tsx` | Edit dialog used by the library |
| `src/components/ask-the-rabbi/manage/CommentsModeration.tsx` | Comment queue, all statuses, full body |
| `src/components/ask-the-rabbi/manage/AtrManageTabs.tsx` | The four-tab switcher |
| `scripts/atr/fix-bylines-and-test-post.ts` | One-off data repair, dry-run by default |
| `scripts/atr/verify-byline-repair.ts` | Reads back the result of the repair |
| `tests/atr-submissions-permissions.test.ts` | Integration: capability gating |
| `tests/atr-quick-post-byline.test.ts` | Integration: byline, via the real route |
| `tests/atr-quick-post-published-at.test.ts` | Integration: publishedAt, via the real route |
| `tests/unit/atr-tabs.test.ts` | Unit: tab slug parsing |

**Modified**

| File | Change |
|---|---|
| `src/app/api/admin/rabbi-submissions/route.ts` | 2 guards → capability (keep null narrowing) |
| `src/app/api/admin/rabbi-submissions/[id]/route.ts` | 3 guards → capability (keep null narrowing) |
| `src/app/api/admin/ask-the-rabbi/route.ts` | Use shared check; fix `publishedAt` at :154; tighten its schema |
| `src/app/api/ask-the-rabbi/quick-post/route.ts` | Accept `publishedAt`; delete the `answeredBy` fallback; fix the misleading MAX+1 comment at :70 |
| `src/components/ask-the-rabbi/AtrQuickPost.tsx` | Add "Answered By"; add an `onPublished` callback |
| `src/app/(admin)/admin/programs/rabbi/page.tsx` | Becomes a shell |
| `src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx` | Becomes a shell |
| `src/app/api/ask-the-rabbi/[id]/comments/route.ts:223` | Repoint `linkUrl` |
| `src/app/api/cron/notification-digest/route.ts:86` | Repoint digest path |
| `src/app/api/ask-the-rabbi/submit/route.ts:67` | Repoint to the submissions tab |
| `tests/utils/test-db.ts` | Whitelist `canManageAskTheRabbi` |

**Deleted**

| File | Why |
|---|---|
| `src/app/(admin)/admin/programs/rabbi/comments/page.tsx` | Replaced by the Comments tab |
| `src/app/api/admin/ask-the-rabbi/submissions/[id]/answer/route.ts` | Dead duplicate publish path |

---

## Chunk 1: API guards and the two Quick Publish bugs

### Task 1: One shared Ask the Rabbi permission check

**Files:**
- Create: `src/lib/auth/atr-permissions.ts`
- Create: `tests/atr-submissions-permissions.test.ts`
- Modify: `tests/utils/test-db.ts`
- Modify: `src/app/api/admin/rabbi-submissions/route.ts` (guards at :12, :110)
- Modify: `src/app/api/admin/rabbi-submissions/[id]/route.ts` (guards at :15, :56, :111)
- Modify: `src/app/api/admin/ask-the-rabbi/route.ts:11-22` (delete the local copy)

- [ ] **Step 1: Let `createTestUser` carry the flag**

In `tests/utils/test-db.ts`, add `canManageAskTheRabbi` to the whitelist inside `createTestUser`, beside the
`canAutoApprove*` fields. Without this the test below passes against a user who never had the flag.

- [ ] **Step 2: Write the failing test**

Create `tests/atr-submissions-permissions.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, cleanupTestUsers, testDb } from "./utils/test-db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canManageAtr } from "@/lib/auth/atr-permissions";

// canManageAtr takes a Session, matching the isAuthorized() it replaces.
const asSession = (id: number, role: string) =>
  ({ user: { id: String(id), role } }) as never;

describe("Ask the Rabbi permission check", () => {
  let adminId: number, managerId: number, plainId: number;

  beforeAll(async () => {
    adminId = (await createTestUser({
      email: "test-atr-admin@frumtoronto.test", role: "admin",
    })).id;
    managerId = (await createTestUser({
      email: "test-atr-manager@frumtoronto.test", role: "member",
      canManageAskTheRabbi: true,
    })).id;
    plainId = (await createTestUser({
      email: "test-atr-plain@frumtoronto.test", role: "member",
    })).id;
  });

  afterAll(async () => { await cleanupTestUsers(); });

  it("allows an admin", async () => {
    expect(await canManageAtr(asSession(adminId, "admin"))).toBe(true);
  });

  it("allows a member holding canManageAskTheRabbi", async () => {
    // Guards against createTestUser silently dropping the field.
    const [row] = await testDb.select({ f: users.canManageAskTheRabbi })
      .from(users).where(eq(users.id, managerId));
    expect(row.f).toBe(true);
    // The whole point: Rabbi Bartfeld is role 'member'.
    expect(await canManageAtr(asSession(managerId, "member"))).toBe(true);
  });

  it("refuses an ordinary member", async () => {
    expect(await canManageAtr(asSession(plainId, "member"))).toBe(false);
  });

  it("refuses a missing session", async () => {
    expect(await canManageAtr(null)).toBe(false);
    expect(await canManageAtr({ user: {} } as never)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:integration -- atr-submissions-permissions`
Expected: FAIL — cannot resolve `@/lib/auth/atr-permissions`.

- [ ] **Step 4: Write the module**

Create `src/lib/auth/atr-permissions.ts`. **It takes a `Session`, not a user** — identical to the
`isAuthorized` it replaces (`api/admin/ask-the-rabbi/route.ts:11`). This matters: a signature taking a
user-shaped object would still typecheck when handed a whole `Session` (every property optional) and
return `false` for everyone, locking both users out with zero type errors.

```ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

/**
 * True for an admin, or for any user holding the canManageAskTheRabbi flag.
 *
 * Takes the whole Session deliberately — every call site already has one, and
 * matching the old isAuthorized() signature means no call site can be migrated
 * wrongly.
 *
 * Reads the database rather than the JWT: the flag is not in the token, and a
 * token minted before the flag was granted would go stale.
 */
export async function canManageAtr(session: Session | null | undefined): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;

  const [dbUser] = await db
    .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .limit(1);

  return dbUser?.canManageAskTheRabbi === true;
}
```

- [ ] **Step 5: Run the test — it should pass**

Run: `npm run test:integration -- atr-submissions-permissions`
Expected: PASS, 4 tests.

- [ ] **Step 6: Apply it to the five submissions handlers**

In **both** `rabbi-submissions/route.ts` and `rabbi-submissions/[id]/route.ts`, import `canManageAtr` and
replace each guard:

```ts
// before
if (!session?.user || session.user.role !== "admin") {

// after — the !session?.user clause STAYS. It is what narrows `session` for
// the later `session.user.id` dereference (route.ts:167, [id]/route.ts:80).
// Dropping it compiles nowhere.
if (!session?.user || !(await canManageAtr(session))) {
```

Five occurrences: `route.ts` :12 and :110; `[id]/route.ts` :15, :56, :111. Confirm none remain:

```bash
grep -rn 'role !== "admin"' src/app/api/admin/rabbi-submissions/
```

Expected: no output.

- [ ] **Step 7: Replace the duplicate in `ask-the-rabbi/route.ts`**

Delete the local `isAuthorized` (lines 11-22). Import `canManageAtr` and use it at the three call sites
(:29, :120, :182). Because the signatures match, each call site is unchanged apart from the name:
`if (!(await canManageAtr(session)))`. Remove the now-unused `users` import if nothing else uses it.

- [ ] **Step 8: Typecheck and test**

```bash
npx tsc --noEmit && npm run test:integration
```

Expected: 0 type errors, all integration tests pass. **If `tsc` reports "possibly null" on `session.user.id`,
a guard lost its `!session?.user` clause — go back to Step 6.**

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth/atr-permissions.ts tests/atr-submissions-permissions.test.ts tests/utils/test-db.ts \
        src/app/api/admin/rabbi-submissions/ src/app/api/admin/ask-the-rabbi/route.ts
git commit -m "fix(atr): gate submissions on the Ask the Rabbi capability, not the admin role

The five rabbi-submissions handlers required role === admin, so the one
person holding canManageAskTheRabbi could not use the submissions inbox at
all. Every other Ask the Rabbi route already accepted the capability."
```

---

### Task 2: Delete the dead answer route

**Files:**
- Delete: `src/app/api/admin/ask-the-rabbi/submissions/[id]/answer/route.ts`

- [ ] **Step 1: Prove nothing calls it**

```bash
grep -rn "ask-the-rabbi/submissions" src/ --include=*.ts --include=*.tsx \
  | grep -v "^src/app/api/admin/ask-the-rabbi/submissions"
```

Expected: no output. **If anything appears, stop** — the route is live and this task is wrong.

- [ ] **Step 2: Delete it**

```bash
git rm -r "src/app/api/admin/ask-the-rabbi/submissions"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(atr): remove the unreachable duplicate answer route

196 lines implementing a second publish path with no callers. The live path
is rabbi-submissions/route.ts; two implementations is what this work removes."
```

---

### Task 3: Q&As must be credited to the Rav, not the poster

**Files:**
- Create: `tests/atr-quick-post-byline.test.ts`
- Modify: `src/app/api/ask-the-rabbi/quick-post/route.ts:65-68, :84, :70`
- Modify: `src/components/ask-the-rabbi/AtrQuickPost.tsx`

- [ ] **Step 1: Write a test that exercises the real route**

This must call the actual handler — a test that inserts directly into the table would pass against the
broken code, because the bug lives in the route, not the schema.

Create `tests/atr-quick-post-byline.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * Quick Publish had no Answered By field, so the route substituted the session
 * user's name — overriding a column default that was already correct. Nine
 * published Q&As carry the wrong byline as a result.
 */

// Must be hoisted: vi.mock inside it() does nothing, and the route 401s
// before touching the DB, so an unmocked test passes against broken code.
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "1", role: "admin", name: "Admin User" },
  })),
}));
vi.mock("@/lib/auth/require-verified", () => ({
  assertCanPost: vi.fn(async () => null),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const { POST } = await import("@/app/api/ask-the-rabbi/quick-post/route");
const { db } = await import("@/lib/db");
const { askTheRabbi } = await import("@/lib/db/schema");

const created: number[] = [];

afterAll(async () => {
  if (created.length) {
    await db.delete(askTheRabbi).where(inArray(askTheRabbi.id, created));
  }
});

function post(body: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/ask-the-rabbi/quick-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never);
}

const RAV = "Hagaon Rav Shlomo Miller Shlit'a";
const base = {
  title: "[TEST] atr byline",
  question: "q".repeat(30),
  answer: "a".repeat(30),
};

describe("quick post byline", () => {
  it("credits the Rav when the form sends no answeredBy", async () => {
    const res = await post(base);
    expect(res.status).toBe(201);
    const row = await res.json();
    created.push(row.id);
    // Fails today: the route writes "Admin User" from the mocked session.
    expect(row.answeredBy).toBe(RAV);
  });

  it("honours an explicit answeredBy", async () => {
    const res = await post({ ...base, answeredBy: "Rabbi Someone Else" });
    const row = await res.json();
    created.push(row.id);
    expect(row.answeredBy).toBe("Rabbi Someone Else");
  });
});
```

- [ ] **Step 2: Run it and watch the first test fail**

Run: `npm run test:integration -- atr-quick-post-byline`
Expected: **FAIL** — `expected 'Admin User' to be "Hagaon Rav Shlomo Miller Shlit'a"`. That failure is the
bug. If it passes, the mock is not taking effect — fix that before continuing, or the test proves nothing.

- [ ] **Step 3: Delete the fallback in the route**

Delete lines 65-68 entirely:

```ts
// DELETE — overrides a correct DB default with the poster's name
const resolvedAnsweredBy =
  answeredBy ||
  [session.user.name].filter(Boolean).join("") ||
  "FrumToronto Rabbi";
```

Change the insert at line 84 from `answeredBy: resolvedAnsweredBy,` to:

```ts
// Omitted when the form sends nothing, so the column default applies
// (schema.ts:539 — "Hagaon Rav Shlomo Miller Shlit'a").
...(answeredBy ? { answeredBy } : {}),
```

`answeredBy` is already destructured at line 62, so it is in scope.

- [ ] **Step 4: Correct the misleading comment at line 70**

It reads "compute inside the insert for safety" — it does not; it is a separate SELECT, so two concurrent
publishes can collide on the unique index. The behaviour is out of scope; the false comment is not:

```ts
// Next question number. NOT atomic — a separate SELECT, so two concurrent
// publishes could collide on the question_number unique index. Acceptable at
// one or two posts a week; revisit if that changes.
```

- [ ] **Step 5: Run the test — both should pass**

Run: `npm run test:integration -- atr-quick-post-byline` → PASS, 2 tests.

- [ ] **Step 6: Add the field to the form**

In `src/components/ask-the-rabbi/AtrQuickPost.tsx`:

```tsx
const [answeredBy, setAnsweredBy] = useState("Hagaon Rav Shlomo Miller Shlit'a");
```

Add to the POST body: `answeredBy: answeredBy.trim() || undefined,`
Reset it in the success handler beside the other fields.
Render above the Published At row, matching the existing markup:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="atr-answered-by" className="text-sm font-medium">
    Answered By
  </Label>
  <Input
    id="atr-answered-by"
    value={answeredBy}
    onChange={(e) => setAnsweredBy(e.target.value)}
    placeholder="Hagaon Rav Shlomo Miller Shlit'a"
    className="bg-white"
  />
</div>
```

This field intentionally appears everywhere `AtrQuickPost` renders, including the public `/ask-the-rabbi`
page — only permitted users ever see the component.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/api/ask-the-rabbi/quick-post/route.ts \
        src/components/ask-the-rabbi/AtrQuickPost.tsx tests/atr-quick-post-byline.test.ts
git commit -m "fix(atr): credit quick-published Q&As to the Rav, not the poster"
```

---

### Task 4: Make the Published At date actually work

**Files:**
- Create: `tests/atr-quick-post-published-at.test.ts`
- Modify: `src/app/api/ask-the-rabbi/quick-post/route.ts:12-21, :86`
- Modify: `src/app/api/admin/ask-the-rabbi/route.ts:113, :154`

- [ ] **Step 1: Write a test that exercises the real route**

Create `tests/atr-quick-post-published-at.test.ts`, same mock preamble as Task 3 (hoisted `vi.mock` for
`auth`, `require-verified`, `notifications`; then `await import` the route):

```ts
import { formatInstant } from "@/lib/datetime";

describe("quick post publishedAt", () => {
  it("uses the date the user picked, on the Toronto day they picked", async () => {
    const res = await post({ ...base, publishedAt: "2026-03-14" });
    expect(res.status).toBe(201);
    const row = await res.json();
    created.push(row.id);

    // Fails today: quickPostSchema omits publishedAt, so Zod strips it and
    // the insert hardcodes new Date().
    const shown = formatInstant(row.publishedAt, {
      month: "numeric", day: "numeric", year: "numeric",
    });
    expect(shown).toBe("3/14/2026");
  });

  it("defaults to now when the form sends nothing", async () => {
    const res = await post(base);
    const row = await res.json();
    created.push(row.id);
    expect(row.publishedAt).toBeTruthy();
    expect(Number.isNaN(new Date(row.publishedAt).getTime())).toBe(false);
  });

  it("rejects a malformed date rather than storing Invalid Date", async () => {
    const res = await post({ ...base, publishedAt: "14/03/2026" });
    expect(res.status).toBe(400);
  });
});
```

Note `formatInstant` accepts `Date | string | null | undefined`, so the JSON string is fine.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:integration -- atr-quick-post-published-at`
Expected: **FAIL** — the first test shows today's date, the third returns 201 instead of 400.

- [ ] **Step 3: Accept `publishedAt` in the schema**

Add to `quickPostSchema` (lines 12-21):

```ts
publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd").optional(),
```

The regex is what makes the third test return 400. Zod's `z.object()` strips unknown keys silently — which
is exactly why the form's value has been ignored since it was written.

- [ ] **Step 4: Use it in the insert**

Destructure `publishedAt` from `result.data`, import the helper, and replace the hard-coded value at :86:

```ts
import { fromDateTimeInputs } from "@/lib/datetime";

publishedAt: publishedAt ? new Date(fromDateTimeInputs(publishedAt)) : new Date(),
```

`fromDateTimeInputs` returns Toronto noon, so the stored instant renders on the chosen day.

- [ ] **Step 5: Fix the same trap on the edit path**

`src/app/api/admin/ask-the-rabbi/route.ts:154` does `new Date(result.data.publishedAt)` on a bare date
string — the identical off-by-one-day bug. **Tighten the schema first**, at line 113, so a malformed value
cannot become `Invalid Date`:

```ts
// before: publishedAt: z.string().optional().nullable(),
publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd").optional().nullable(),
```

Then line 154:

```ts
updates.publishedAt = result.data.publishedAt
  ? new Date(fromDateTimeInputs(result.data.publishedAt))
  : null;
```

The only current caller sends a bare `yyyy-mm-dd` (`(dashboard)/…/page.tsx:133`), so the regex breaks
nothing.

- [ ] **Step 6: Run everything**

```bash
npx tsc --noEmit && npm run test:unit && npm run test:integration
```

Expected: 0 errors, all green.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/ask-the-rabbi/quick-post/route.ts src/app/api/admin/ask-the-rabbi/route.ts \
        tests/atr-quick-post-published-at.test.ts
git commit -m "fix(atr): honour the Published At date instead of discarding it

The composer collected a date and sent it; the schema did not list it, so Zod
stripped it and the insert hardcoded now(). Both write paths now parse the
value as a Toronto day rather than UTC midnight, which rendered a day early."
```

---

## Chunk 2: Extract the screens and rewire both shells

### Task 5: Extract the questions library and its edit dialog

**Files:**
- Create: `src/components/ask-the-rabbi/manage/QuestionEditDialog.tsx`
- Create: `src/components/ask-the-rabbi/manage/QuestionsLibrary.tsx`
- Modify: `src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx`

- [ ] **Step 1: Move `EditDialog` out verbatim**

Cut `EditDialog` plus the `Question` and `Pagination` interfaces into `QuestionEditDialog.tsx`. Add
`"use client"`. Export the component as `QuestionEditDialog` and both types.

- [ ] **Step 2: Move `QuestionsTab` out verbatim**

Cut `QuestionsTab` and `PublishedBadge` into `QuestionsLibrary.tsx`, exporting `QuestionsLibrary`.

**Do not add a page heading.** The admin shell inherits its `<h1>` from
`(admin)/admin/programs/layout.tsx:19`; the dashboard shell supplies its own `CardTitle`. A heading inside
the component doubles up in one shell.

- [ ] **Step 3: Import them back into the dashboard page, and clear dead imports**

Replace the removed in-file components with imports, then delete any now-unused imports from `page.tsx`
(likely `Pencil`, `Trash2`, `ExternalLink`, `UniversalSearch`, `formatInstant`). Unused imports are eslint
errors and the baseline must not grow.

- [ ] **Step 4: Verify it still renders**

```bash
npx tsc --noEmit && npm run lint
npm run dev
```

As admin, open `http://localhost:3000/dashboard/ask-the-rabbi`: the table lists questions, the footer reads
`5521 questions — page 1 of 221` (5520/221 after Task 10), search filters, the edit dialog saves.

- [ ] **Step 5: Commit**

```bash
git add src/components/ask-the-rabbi/manage/ "src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx"
git commit -m "refactor(atr): extract the questions library into a shared component"
```

---

### Task 6: Extract the submissions inbox

**Files:**
- Create: `src/components/ask-the-rabbi/manage/SubmissionsInbox.tsx`
- Modify: `src/app/(admin)/admin/programs/rabbi/page.tsx`

- [ ] **Step 1: Move the component out**

Move the whole body of the admin page — state, `fetchSubmissions`, `generateTitle`, `openAnswerDialog`,
`handlePublish`, `handleReject`, `handleDelete`, `getStatusBadge`, the card list and the answer dialog —
into `SubmissionsInbox.tsx` as an exported `SubmissionsInbox`.

Leave behind the "Manage question submissions" caption and the "Moderation Comments" `<Link>` (:214-220);
both belong to the shell and the link is deleted in Task 9.

- [ ] **Step 2: Render it from the admin page and clear dead imports**

The page becomes a shell rendering `<SubmissionsInbox />`. Delete imports it no longer uses — at minimum
`Link` and `MessageSquare` once the button goes in Task 9.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Open `/admin/programs/rabbi` as admin. Expect the four status tabs and "No pending submissions found" —
the table is empty in production, so an empty state is correct, not a failure.

- [ ] **Step 4: Commit**

```bash
git add src/components/ask-the-rabbi/manage/SubmissionsInbox.tsx "src/app/(admin)/admin/programs/rabbi/page.tsx"
git commit -m "refactor(atr): extract the submissions inbox into a shared component"
```

---

### Task 7: Merge the two comment moderation screens into one

**Files:**
- Create: `src/components/ask-the-rabbi/manage/CommentsModeration.tsx`
- Modify: `src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx`

- [ ] **Step 1: Start from the admin implementation**

Copy `(admin)/.../rabbi/comments/page.tsx` into `CommentsModeration.tsx` as an exported component. Keep the
status filter (:203-222), delete with its confirm dialog (:317-325, :366-396), status badges, and
re-approve of non-pending rows (:306-316). Drop the "Back to Submissions" link (:196-201) — it is a tab now.

- [ ] **Step 2: Stop truncating the comment body**

Delete `truncateText` (:187-190) and its use at :262. Render the full body as the dashboard version does:

```tsx
<p className="whitespace-pre-wrap text-sm text-gray-700">{comment.content}</p>
```

Moderating on the first 100 characters is not a decision anyone can make properly.

- [ ] **Step 3: Add per-row in-flight state**

The admin version refetches the list after an action with no per-button disable, so a double-click fires it
twice. Port `actingId` from the dashboard version (`(dashboard)/…/page.tsx:514`) and disable that row's
buttons while it is set.

- [ ] **Step 4: Delete `PendingCommentsTab` and its `PendingComment` interface from the dashboard page**

- [ ] **Step 5: Verify against real data**

`npx tsc --noEmit && npm run lint`, then in the browser: the database holds exactly **1 comment, approved,
on question 5527** — so **Pending is empty and All shows one row**. If All is also empty the status filter
is broken.

- [ ] **Step 6: Commit**

```bash
git add src/components/ask-the-rabbi/manage/CommentsModeration.tsx "src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx"
git commit -m "refactor(atr): one comment moderation screen instead of two

Keeps the admin version's status filter, delete and re-approve; takes the
dashboard version's untruncated body and per-row in-flight state. The admin
copy showed only the first 100 characters of a comment being moderated."
```

---

### Task 8: The four-tab switcher, genuinely driven by the URL

**Files:**
- Create: `src/components/ask-the-rabbi/manage/atr-tabs.ts`
- Create: `src/components/ask-the-rabbi/manage/AtrManageTabs.tsx`
- Create: `tests/unit/atr-tabs.test.ts`
- Modify: both shells

Tab state lives in the URL because three server-side notifications deep-link into these pages (Task 9).
Clicking a tab must update the URL, and changing the URL must change the tab — a `useState` seeded once
from a prop does neither.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/atr-tabs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAtrTab, ATR_TABS } from "@/components/ask-the-rabbi/manage/atr-tabs";

describe("parseAtrTab", () => {
  it("defaults to submissions", () => {
    expect(parseAtrTab(null)).toBe("submissions");
    expect(parseAtrTab("")).toBe("submissions");
    expect(parseAtrTab(undefined)).toBe("submissions");
  });

  it("accepts every known slug", () => {
    for (const t of ATR_TABS) expect(parseAtrTab(t.key)).toBe(t.key);
  });

  it("falls back rather than rendering nothing for junk", () => {
    expect(parseAtrTab("../etc/passwd")).toBe("submissions");
    expect(parseAtrTab("QUESTIONS")).toBe("submissions");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:unit -- atr-tabs` → FAIL, module not found.

- [ ] **Step 3: Write the slugs as plain TypeScript**

`atr-tabs.ts` — **no `"use client"`, no React, no component imports.** The unit project runs in a Node
environment with no DOM; keeping this file free of the component tree is what guarantees the test stays
runnable no matter what those components later import.

```ts
export const ATR_TABS = [
  { key: "submissions", label: "Submissions" },
  { key: "questions",   label: "Questions" },
  { key: "new",         label: "New" },
  { key: "comments",    label: "Comments" },
] as const;

export type AtrTab = (typeof ATR_TABS)[number]["key"];

export const DEFAULT_ATR_TAB: AtrTab = "submissions";

export function parseAtrTab(value: string | null | undefined): AtrTab {
  const match = ATR_TABS.find((t) => t.key === value);
  return match ? match.key : DEFAULT_ATR_TAB;
}
```

- [ ] **Step 4: Run the test — 3 passing**

- [ ] **Step 5: Write the switcher**

`AtrManageTabs.tsx`. It derives the tab from the URL on every render and writes back on click, so both
directions work:

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ATR_TABS, parseAtrTab, type AtrTab } from "./atr-tabs";
import { SubmissionsInbox } from "./SubmissionsInbox";
import { QuestionsLibrary } from "./QuestionsLibrary";
import { CommentsModeration } from "./CommentsModeration";
import { AtrQuickPost } from "../AtrQuickPost";

export function AtrManageTabs({ defaultTab }: { defaultTab?: AtrTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derived, not stored: a ?tab= change from any source switches the view.
  const raw = searchParams.get("tab");
  const tab: AtrTab = raw ? parseAtrTab(raw) : (defaultTab ?? parseAtrTab(null));

  const select = (next: AtrTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b" role="tablist">
        {ATR_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => select(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "submissions" && <SubmissionsInbox />}
      {tab === "questions" && <QuestionsLibrary />}
      {tab === "new" && <AtrQuickPost canManageAtr={true} onPublished={() => select("questions")} />}
      {tab === "comments" && <CommentsModeration />}
    </div>
  );
}
```

`router.replace` rather than `push` so the back button leaves the page instead of walking back through tabs.

`canManageAtr={true}` is safe: both shells gate on the capability before rendering, and every API the
component calls re-checks server-side.

- [ ] **Step 6: Give `AtrQuickPost` an `onPublished` callback**

`AtrQuickPost` currently calls `router.refresh()` on success (`:75`), which refreshes server-rendered
content and is therefore a **no-op for the client-fetched Questions list** — publish from New and the
Questions tab stays stale. Add an optional prop:

```tsx
interface AtrQuickPostProps {
  canManageAtr: boolean;
  onPublished?: () => void;
}
```

Call `onPublished?.()` after `router.refresh()` in the success path. The public page passes nothing and is
unaffected; the manage tabs use it to jump to Questions, which fetches fresh on mount.

- [ ] **Step 7: Wire the admin shell**

`(admin)/admin/programs/rabbi/page.tsx`. `AtrManageTabs` uses `useSearchParams`, so it needs a Suspense
boundary. The parent layout is `"use client"`, but `children` arrives as an already-rendered slot, so a
server page here is valid:

```tsx
import { Suspense } from "react";
import { AtrManageTabs } from "@/components/ask-the-rabbi/manage/AtrManageTabs";

export const dynamic = "force-dynamic";

export default function AdminAtrPage() {
  return (
    <Suspense fallback={null}>
      <AtrManageTabs />
    </Suspense>
  );
}
```

Defaults to Submissions, matching today's admin landing screen.

- [ ] **Step 8: Wire the dashboard shell**

Keep its `"use client"` shell — back link, card, the `canManage` probe (:703-707), and the loading and
access-denied states. Replace the three-tab nav and `activeTab` state with:

```tsx
<Suspense fallback={null}>
  <AtrManageTabs defaultTab="questions" />
</Suspense>
```

**`defaultTab="questions"` is deliberate.** This page currently lands on All Questions (:696), and the
submissions table has zero rows — defaulting the one non-admin manager to a permanently empty inbox would
be a downgrade. An explicit `?tab=` still wins.

- [ ] **Step 9: Verify both shells**

```bash
npx tsc --noEmit && npm run test:unit && npm run lint
```

With the dev server:

| URL | Expected |
|---|---|
| `/admin/programs/rabbi` | Submissions |
| `/admin/programs/rabbi?tab=questions` | Questions, 5,521 rows |
| `/admin/programs/rabbi?tab=nonsense` | Submissions (fallback) |
| `/dashboard/ask-the-rabbi` | Questions |
| `/dashboard/ask-the-rabbi?tab=new` | The composer |

Then, on one page: **click each tab and confirm the address bar updates**, use the browser back button, and
edit `?tab=` by hand to confirm the view follows. That is the half a `useState` implementation fails.

- [ ] **Step 10: Commit**

```bash
git add src/components/ask-the-rabbi/manage/ tests/unit/atr-tabs.test.ts \
        "src/app/(admin)/admin/programs/rabbi/page.tsx" "src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx" \
        src/components/ask-the-rabbi/AtrQuickPost.tsx
git commit -m "feat(atr): same four management tabs in both shells, addressable by URL

Tab state is derived from ?tab= and written back on click, so notification
links can deep-link and the back button behaves."
```

---

### Task 9: Delete the old comments page and repoint everything aimed at it

**Files:**
- Delete: `src/app/(admin)/admin/programs/rabbi/comments/page.tsx`
- Modify: three API files

- [ ] **Step 1: Find every reference**

```bash
grep -rn "admin/programs/rabbi" src/ --include=*.ts --include=*.tsx
```

Expected: the Programs tab definition, the three `linkUrl`s, and any leftover "Moderation Comments" button.
**Handle every hit** — two are inside API files and easy to miss.

- [ ] **Step 2: Repoint the three links**

| File:line | New value |
|---|---|
| `api/ask-the-rabbi/[id]/comments/route.ts:223` | `"/admin/programs/rabbi?tab=comments"` |
| `api/cron/notification-digest/route.ts:86` | `"/admin/programs/rabbi?tab=comments"` |
| `api/ask-the-rabbi/submit/route.ts:67` | `"/admin/programs/rabbi?tab=submissions"` |

- [ ] **Step 3: Delete the page**

```bash
git rm -r "src/app/(admin)/admin/programs/rabbi/comments"
```

- [ ] **Step 4: Confirm nothing still points at the dead route**

```bash
grep -rn "rabbi/comments" src/
```

Expected: no output.

- [ ] **Step 5: Typecheck, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: 0 type errors; eslint no worse than **49 errors / 186 warnings**; the build compiles.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(atr): fold comment moderation into the Comments tab

Deletes the standalone page and repoints the three server-side links that
aimed at it — the in-app notification, the daily digest and the submission
notification."
```

---

## Chunk 3: Production data repair

Two writes to live data. Both re-verify their targets immediately before writing rather than trusting this
document, and both are reversible from the values recorded in the spec.

### Task 10: Fix the nine bylines and delete the test post

**Files:**
- Create: `scripts/atr/fix-bylines-and-test-post.ts`
- Create: `scripts/atr/verify-byline-repair.ts`

Scripts live under `scripts/` so `npx tsx` resolves the `@/` alias via `tsconfig.json` paths — the same
pattern `scripts/seed-form-recipients.ts` uses. A script outside the repo tree will not resolve `@/`.

- [ ] **Step 1: Write the repair script, dry-run by default**

```ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const COMMIT = process.argv.includes("--commit");
const RAV = "Hagaon Rav Shlomo Miller Shlit'a";
const BYLINE_IDS = [5520, 5521, 5522, 5523, 5524, 5525, 5526, 5527, 5528];
const TEST_POST_ID = 5519;

async function main() {
  const { db } = await import("@/lib/db");
  const { askTheRabbi } = await import("@/lib/db/schema");
  const { inArray, eq } = await import("drizzle-orm");

  // Re-verify before touching anything. The ids are recorded in the spec, but a
  // stale id list is exactly how the wrong row gets rewritten.
  const targets = await db.select().from(askTheRabbi)
    .where(inArray(askTheRabbi.id, BYLINE_IDS));

  console.log(`Byline targets found: ${targets.length} (expected 9)`);
  for (const r of targets) console.log(`  #${r.questionNumber} ${r.title} — "${r.answeredBy}"`);
  if (targets.length !== 9) throw new Error("Expected exactly 9 rows; aborting.");

  const wrong = targets.filter((r) => r.answeredBy !== RAV);
  if (wrong.length !== 9) console.warn(`Note: only ${wrong.length} still carry a wrong byline.`);

  const [testPost] = await db.select().from(askTheRabbi)
    .where(eq(askTheRabbi.id, TEST_POST_ID));
  if (!testPost) throw new Error("Test post 5519 not found; aborting.");
  if (!/test/i.test(testPost.title)) {
    throw new Error(`Row 5519 is "${testPost.title}" — not the expected test post. Aborting.`);
  }
  console.log(`Test post to delete: #${testPost.questionNumber} ${testPost.title}`);

  if (!COMMIT) {
    console.log("\nDRY RUN — pass --commit to apply.");
    return;
  }

  const updated = await db.update(askTheRabbi).set({ answeredBy: RAV })
    .where(inArray(askTheRabbi.id, BYLINE_IDS)).returning({ id: askTheRabbi.id });
  console.log(`Rewrote ${updated.length} bylines.`);

  const deleted = await db.delete(askTheRabbi)
    .where(eq(askTheRabbi.id, TEST_POST_ID)).returning({ id: askTheRabbi.id });
  console.log(`Deleted ${deleted.length} test post.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

The title check on 5519 is the important guard: this is a destructive delete on production, and the cost of
a stale id is a real Q&A removed from a public page. The `.catch` turns an abort into a clean message and a
non-zero exit rather than an unhandled rejection.

- [ ] **Step 2: Write the verification script**

`scripts/atr/verify-byline-repair.ts`:

```ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const { db } = await import("@/lib/db");
  const { askTheRabbi } = await import("@/lib/db/schema");
  const { sql, eq, desc } = await import("drizzle-orm");

  const byline = await db
    .select({ by: askTheRabbi.answeredBy, c: sql<number>`count(*)` })
    .from(askTheRabbi).groupBy(askTheRabbi.answeredBy)
    .orderBy(desc(sql`count(*)`));
  console.log("answered_by distribution:");
  console.table(byline);

  const [gone] = await db.select({ id: askTheRabbi.id })
    .from(askTheRabbi).where(eq(askTheRabbi.id, 5519));
  console.log(`Row 5519 present: ${gone ? "YES — repair incomplete" : "no ✓"}`);

  const [total] = await db.select({ c: sql<number>`count(*)` }).from(askTheRabbi);
  console.log(`Total Q&As: ${total.c} (expected 5520)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Dry run**

```bash
npx tsx scripts/atr/fix-bylines-and-test-post.ts
```

Expected: 9 targets listed, the test post identified as `#8204 THis is a test for Ask the rabbi`, and
`DRY RUN`. **Read the nine titles** — they should be the numbered 6012–6024 series. Anything unfamiliar,
stop and report it.

- [ ] **Step 4: Apply**

```bash
npx tsx scripts/atr/fix-bylines-and-test-post.ts --commit
```

Expected: `Rewrote 9 bylines.` and `Deleted 1 test post.`

- [ ] **Step 5: Verify**

```bash
npx tsx scripts/atr/verify-byline-repair.ts
```

Expected: a single row in the distribution — the Rav, **5520**; `Row 5519 present: no ✓`;
`Total Q&As: 5520`.

- [ ] **Step 6: Commit the scripts**

```bash
git add scripts/atr/
git commit -m "chore(atr): scripts to repair the nine wrong bylines and remove the test post

Dry-run by default. Re-verifies both targets before writing and refuses to
delete row 5519 if its title is not the expected test post."
```

---

### Task 11: Final verification

- [ ] **Step 1: Automated**

```bash
npx tsc --noEmit
npm run test:unit
npm run test:integration
npm run lint
npm run build
```

Expected: 0 type errors; all tests pass; eslint no worse than 49 errors / 186 warnings; the build compiles.

If integration tests fail in a burst with `NeonDbError: fetch failed` across unrelated files and the run
takes far longer than usual, that is the Neon test branch suspending, not a code failure. Re-run before
investigating.

- [ ] **Step 2: As an admin, in a browser**

All four tabs in both shells. Confirm: Questions lists **5,520** rows across 221 pages, search works, the
edit dialog saves, the publish toggle flips, Comments shows one row under "All" and none under "Pending",
and the composer publishes with the correct byline and the picked date.

- [ ] **Step 3: As the non-admin manager — the point of the whole exercise**

Create a throwaway user with `role: "member"` and `canManageAskTheRabbi: true`, log in as them, and confirm:

- `/dashboard/ask-the-rabbi` loads and **all four tabs work, Submissions included**. Before this work its
  API returned 401 for this user.
- `/admin` and `/admin/programs/rabbi` still redirect away. The capability must not have become a way into
  the admin panel.

Delete the throwaway user afterwards.

- [ ] **Step 4: Deep links and tab URL behaviour**

Visit `/admin/programs/rabbi?tab=comments` and `?tab=submissions` — the two paths the repointed
notifications now use. Then click between tabs and confirm the address bar tracks the selection.

---

## Definition of done

- Both shells render the same four tabs; both work for both users.
- The five `rabbi-submissions` handlers accept the capability; `grep -rn 'role !== "admin"' src/app/api/admin/rabbi-submissions/` returns nothing.
- The standalone comments page and the dead answer route are gone; no reference to either remains.
- `answered_by` is the Rav on all 5,520 rows; row 5519 no longer exists.
- Quick Publish has an Answered By field, and its Published At date lands on the day chosen.
- Clicking a tab updates the URL; changing the URL changes the tab.
- `tsc` 0 errors, tests green, eslint no worse than baseline, `next build` compiles.
