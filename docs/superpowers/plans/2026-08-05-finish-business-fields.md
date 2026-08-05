# Finish the Business Fields — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make five business fields that exist in the database actually editable and visible, so the owner-editing feature has real fields to offer.

**Architecture:** Purely additive. Five fields gain a write path through the admin edit route, two of them gain a public render, and one plan-capability helper is extracted so it can be shared. No new tables, no new routes, no behaviour change for anything that works today.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres (`neon-http`), Zod, vitest (`unit` and `integration` projects), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-04-business-claim-and-owner-editing-design.md`, Part 0.

---

## Why this is its own plan

The spec makes Part 0 a prerequisite: *"An owner editor offering a logo that nothing can store, or social links that never appear, would be the photo-gallery mistake repeated four times."*

It is also independently valuable. Today **the admin cannot set a logo on any business, through any route.** Finishing these fields means the directory can be maintained properly whether or not owner editing ever ships.

## Context an engineer new to this codebase needs

**Measured on production, 2026-08-04.** Do not assume a field works because it exists in `schema.ts` — that assumption produced four wrong drafts of the spec.

| Field | Writable where today | Renders publicly | Rows with data |
|---|---|---|---|
| `logoUrl` | **nowhere** | yes, gated on `showLogo` | **0** of 1,635 |
| `contactName` | user registration only | selected, never rendered | 1 |
| `socialLinks` | user registration only | selected, never rendered | **0** |
| `additionalCategoryIds` | user registration only | no | **0** |
| `diningType` | admin edit only | restaurants only | **0** |

"User registration only" means `POST /api/businesses/create`. Those three are **create-only**: a business sets them at signup and then nobody — owner or admin — can ever change them, because the admin update omits the keys and so silently leaves stale values rather than clearing them.

**`show_contact_name` and `show_social_links` gate nothing.** They are selected on the listing page and never used. This plan makes them real.

**There are no transactions.** `db` is `neon-http`; `db.transaction` does not exist. Nothing in this plan needs one.

**Test projects.** `npm run test:unit` needs no database. `npm run test:integration` needs `.env.test` and runs `tests/*.test.ts` (not nested), sequentially.

**Run `tsc` before every commit.** Drizzle silently ignores unknown keys in `.values()` and `.set()`, so a typo'd column is invisible at runtime — which is exactly how `tagline` and `bannerImageUrl` came to be silently dropped by the admin create route.

**The eslint baseline is 49 errors / 182 warnings.** Do not fix the pre-existing ones.

---

## File structure

**Modified**

| File | Change |
|---|---|
| `src/lib/validations/content.ts` | `businessSchema` gains 5 fields; `socialLinksSchema` extracted and exported |
| `src/app/api/businesses/create/route.ts` | Import the shared `socialLinksSchema` instead of its local copy |
| `src/app/api/admin/businesses/[id]/route.ts` | The `.set()` carries the 5 fields |
| `src/app/api/admin/businesses/route.ts` | The create `.values()` carries `tagline` and `bannerImageUrl`, which it currently validates and drops |
| `src/components/admin/BusinessForm.tsx` | Inputs for logo, contact name, social links, additional categories |
| `src/app/directory/business/[slug]/page.tsx` | Render contact name and social links; export `canShowFeature` |

**Created**

| File | Responsibility |
|---|---|
| `src/lib/businesses/plan-capability.ts` | `canShowFeature` — plan capability, shared by the listing page and (later) the owner editor |
| `tests/business-field-write-paths.test.ts` | Integration: every field survives a round trip through the admin routes |
| `tests/unit/plan-capability.test.ts` | Unit: capability rules including the plan-less default |

---

## Chunk 1: Make the fields writable

### Task 1: Extract the social-links schema so it can be shared

`socialLinks` has a Zod shape in exactly one place — a **local const** inside
`api/businesses/create/route.ts`. `businessSchema` needs the same shape, and the
owner editor will need it again later.

**Files:**
- Modify: `src/lib/validations/content.ts`
- Modify: `src/app/api/businesses/create/route.ts`

- [ ] **Step 1: Add the shared schema**

In `src/lib/validations/content.ts`, above `businessSchema`:

```ts
/**
 * The four platforms the business registration form collects. Shared so the
 * admin form, the create route and the owner editor cannot drift apart.
 */
export const socialLinksSchema = z
  .object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
  })
  .nullable()
  .optional();
```

- [ ] **Step 2: Point the create route at it**

In `src/app/api/businesses/create/route.ts`, replace the inline
`socialLinks: z.object({...}).nullable().optional()` inside
`createBusinessSchema` with `socialLinks: socialLinksSchema`, and import it:

```ts
import { socialLinksSchema } from "@/lib/validations/content";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. The shape is identical, so nothing else moves.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/content.ts src/app/api/businesses/create/route.ts
git commit -m "refactor(businesses): share the socialLinks schema

It existed only as a local const in the create route. The admin form and the
owner editor both need the same shape; three copies would drift."
```

---

### Task 2: The five fields survive a round trip

**Files:**
- Create: `tests/business-field-write-paths.test.ts`
- Modify: `src/lib/validations/content.ts`
- Modify: `src/app/api/admin/businesses/[id]/route.ts`

- [ ] **Step 1: Write the failing test**

This asserts the **database** outcome, not the schema — the bug being fixed is
that values pass validation and are then dropped by the `.set()`.

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { PUT } = await import("@/app/api/admin/businesses/[id]/route");
const { db } = await import("@/lib/db");
const { businesses, businessCategories } = await import("@/lib/db/schema");

const stamp = Date.now();
let businessId: number;
let categoryId: number;
let extraCategoryId: number;

beforeAll(async () => {
  const [c1] = await db.insert(businessCategories)
    .values({ name: `[TEST] cat a ${stamp}`, slug: `test-cat-a-${stamp}` })
    .returning({ id: businessCategories.id });
  const [c2] = await db.insert(businessCategories)
    .values({ name: `[TEST] cat b ${stamp}`, slug: `test-cat-b-${stamp}` })
    .returning({ id: businessCategories.id });
  categoryId = c1.id;
  extraCategoryId = c2.id;

  const [b] = await db.insert(businesses)
    .values({ name: `[TEST] fields ${stamp}`, slug: `test-fields-${stamp}`, categoryId })
    .returning({ id: businesses.id });
  businessId = b.id;
});

afterAll(async () => {
  await db.delete(businesses).where(eq(businesses.id, businessId));
  await db.delete(businessCategories).where(eq(businessCategories.id, categoryId));
  await db.delete(businessCategories).where(eq(businessCategories.id, extraCategoryId));
});

function put(body: Record<string, unknown>) {
  return PUT(
    new Request(`http://localhost/api/admin/businesses/${businessId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `[TEST] fields ${stamp}`, ...body }),
    }) as never,
    { params: Promise.resolve({ id: String(businessId) }) } as never
  );
}

async function row() {
  const [r] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  return r;
}

describe("admin edit writes every editable field", () => {
  it("stores the logo", async () => {
    const res = await put({ logoUrl: "https://example.com/logo.png" });
    expect(res.status).toBe(200);
    // Fails before the fix: logoUrl is in no schema and no .set() anywhere.
    expect((await row()).logoUrl).toBe("https://example.com/logo.png");
  });

  it("stores the contact name", async () => {
    await put({ contactName: "Chaim Rosenberg" });
    expect((await row()).contactName).toBe("Chaim Rosenberg");
  });

  it("stores social links", async () => {
    await put({ socialLinks: { facebook: "https://fb.com/x", instagram: "" } });
    expect((await row()).socialLinks).toMatchObject({ facebook: "https://fb.com/x" });
  });

  it("stores additional categories", async () => {
    await put({ additionalCategoryIds: [extraCategoryId] });
    expect((await row()).additionalCategoryIds).toEqual([extraCategoryId]);
  });

  it("stores dining type", async () => {
    await put({ diningType: "dairy" });
    expect((await row()).diningType).toBe("dairy");
  });

  it("clears a field when an empty value is sent", async () => {
    // The create-only bug left stale values because the key was omitted.
    // An explicit null must actually clear.
    await put({ contactName: null });
    expect((await row()).contactName).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:integration -- business-field-write-paths`
Expected: **FAIL** — the first test returns 200 but `logoUrl` is null, because
`businessSchema` strips the key and the `.set()` never mentions it.

- [ ] **Step 3: Add the fields to `businessSchema`**

In `src/lib/validations/content.ts`, inside `businessSchema`:

```ts
  logoUrl: z.string().max(500).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  socialLinks: socialLinksSchema,
  additionalCategoryIds: z.array(z.number().int().positive()).optional().nullable(),
```

`diningType` is already present. Do **not** add `userId`, `subscriptionPlanId`,
`approvalStatus` or `isActive` — those stay admin-route-only concerns and this
schema is reused by the admin create route.

- [ ] **Step 4: Carry them through the admin update**

In `src/app/api/admin/businesses/[id]/route.ts`, add to the `.set({...})`:

```ts
        logoUrl: validatedData.logoUrl ?? null,
        contactName: validatedData.contactName ?? null,
        socialLinks: validatedData.socialLinks ?? null,
        additionalCategoryIds: validatedData.additionalCategoryIds ?? null,
```

`?? null` rather than `|| null` so an explicit empty string is preserved where
the column allows it, and so the "clears a field" test passes.

- [ ] **Step 5: Run the test — all six pass**

Run: `npm run test:integration -- business-field-write-paths`
Expected: PASS, 6 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/validations/content.ts "src/app/api/admin/businesses/[id]/route.ts" tests/business-field-write-paths.test.ts
git commit -m "fix(businesses): the admin edit route can write five more fields

logoUrl had no write path anywhere — 0 of 1,635 businesses have one and
nothing could set it. contactName, socialLinks and additionalCategoryIds were
create-only: set at registration, then unchangeable, because the admin update
omitted the keys and so left stale values rather than clearing them."
```

---

### Task 3: The admin create route stops dropping fields

`POST /api/admin/businesses` validates against `businessSchema` — which accepts
`tagline` and `bannerImageUrl` — and then writes an explicit field list that
omits both. An admin creating a business with a tagline gets no tagline and no
error.

**Files:**
- Modify: `src/app/api/admin/businesses/route.ts`
- Modify: `tests/business-field-write-paths.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the test file, importing `POST` alongside `PUT`:

```ts
describe("admin create does not silently drop validated fields", () => {
  it("stores tagline and banner given at creation", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `[TEST] create drop ${stamp}`,
          categoryId,
          tagline: "Fresh challah every Thursday",
          bannerImageUrl: "https://example.com/banner.png",
        }),
      }) as never
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    createdIds.push(created.id);

    // Fails before the fix: both are validated, then omitted from .values().
    expect(created.tagline).toBe("Fresh challah every Thursday");
    expect(created.bannerImageUrl).toBe("https://example.com/banner.png");
  });
});
```

Add `const createdIds: number[] = [];` beside the other state, and delete those
rows in `afterAll`.

- [ ] **Step 2: Run it and watch it fail**

Expected: `expected null to be "Fresh challah every Thursday"`.

- [ ] **Step 3: Add the fields to the insert**

In `src/app/api/admin/businesses/route.ts`, inside the `.values({...})`:

```ts
        tagline: validatedData.tagline ?? null,
        bannerImageUrl: validatedData.bannerImageUrl ?? null,
        logoUrl: validatedData.logoUrl ?? null,
        contactName: validatedData.contactName ?? null,
        socialLinks: validatedData.socialLinks ?? null,
        additionalCategoryIds: validatedData.additionalCategoryIds ?? null,
```

- [ ] **Step 4: Run, typecheck, commit**

```bash
npm run test:integration -- business-field-write-paths
npx tsc --noEmit
git add src/app/api/admin/businesses/route.ts tests/business-field-write-paths.test.ts
git commit -m "fix(businesses): admin create stops silently dropping validated fields

The route validated tagline and bannerImageUrl through businessSchema and
then wrote an explicit field list omitting both, so an admin creating a
business with a tagline got neither the value nor an error."
```

---

## Chunk 2: Make the fields visible

### Task 4: Extract the plan-capability helper

`canShowFeature` is module-private inside the listing page. The owner editor and
the server-side rejection rules will both need it.

**Files:**
- Create: `src/lib/businesses/plan-capability.ts`
- Create: `tests/unit/plan-capability.test.ts`
- Modify: `src/app/directory/business/[slug]/page.tsx`

- [ ] **Step 1: Write the failing unit test**

```ts
import { describe, it, expect } from "vitest";
import { canShowFeature } from "@/lib/businesses/plan-capability";

describe("canShowFeature", () => {
  it("reads the flag from the plan", () => {
    expect(canShowFeature({ showLogo: true } as never, "showLogo")).toBe(true);
    expect(canShowFeature({ showLogo: false } as never, "showLogo")).toBe(false);
  });

  it("denies everything when there is no plan", () => {
    // A business with a NULL subscriptionPlanId shows nothing gated.
    // This is the existing behaviour and is preserved deliberately.
    expect(canShowFeature(null, "showLogo")).toBe(false);
    expect(canShowFeature(null, "showDescription")).toBe(false);
  });

  it("treats a missing flag as denied", () => {
    expect(canShowFeature({} as never, "showLogo")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:unit -- plan-capability`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Lift the function from `directory/business/[slug]/page.tsx` verbatim so
behaviour cannot drift:

```ts
import type { subscriptionPlans } from "@/lib/db/schema";

type PlanCapabilities = Partial<typeof subscriptionPlans.$inferSelect>;

/**
 * Whether a plan grants a display capability.
 *
 * No plan means no gated features. Note the sibling rule for COUNT limits
 * (maxCategories) reads the other way — `if (plan && plan.maxCategories !== null)`
 * skips the check entirely without a plan. Keep that in mind before copying
 * this default onto a limit.
 */
export function canShowFeature(
  plan: PlanCapabilities | null,
  feature: keyof PlanCapabilities
): boolean {
  if (!plan) return false;
  return plan[feature] === true;
}
```

- [ ] **Step 4: Point the listing page at it**

Delete the local `canShowFeature` from
`src/app/directory/business/[slug]/page.tsx` and import the shared one. The
seven existing call sites are unchanged.

- [ ] **Step 5: Run both test projects**

```bash
npm run test:unit -- plan-capability
npx tsc --noEmit
```

Expected: 3 passing, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/businesses/plan-capability.ts tests/unit/plan-capability.test.ts "src/app/directory/business/[slug]/page.tsx"
git commit -m "refactor(businesses): share the plan-capability check

It was module-private in the listing page; the owner editor and the
server-side plan rules both need the same definition."
```

---

### Task 5: Render contact name and social links

Both are selected on the listing page and never used, so `show_contact_name`
and `show_social_links` currently gate nothing.

**Files:**
- Modify: `src/app/directory/business/[slug]/page.tsx`

- [ ] **Step 1: Add the capability checks**

Beside the seven existing ones:

```ts
  const showContactName = canShowFeature(plan, "showContactName");
  const showSocialLinks = canShowFeature(plan, "showSocialLinks");
```

- [ ] **Step 2: Render contact name**

In the contact details block, following the existing pattern for phone and
email:

```tsx
{showContactName && business.contactName && (
  <div className="flex items-center gap-2 text-gray-700">
    <User className="h-4 w-4 text-gray-400" />
    <span>{business.contactName}</span>
  </div>
)}
```

- [ ] **Step 3: Render social links**

```tsx
{showSocialLinks && business.socialLinks && (
  <div className="flex items-center gap-3">
    {(["facebook", "instagram", "twitter", "linkedin"] as const).map((k) => {
      const href = (business.socialLinks as Record<string, string> | null)?.[k];
      if (!href) return null;
      return (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer"
           className="text-gray-400 hover:text-gray-600" aria-label={k}>
          {SOCIAL_ICONS[k]}
        </a>
      );
    })}
  </div>
)}
```

Define `SOCIAL_ICONS` from `lucide-react` (`Facebook`, `Instagram`, `Twitter`,
`Linkedin`). Empty strings are skipped — the registration form submits `""` for
platforms left blank.

- [ ] **Step 4: Verify in a browser**

```bash
npm run dev
```

Production has **0 businesses with social links and 1 with a contact name**, so
set both on a test business first (via the admin form after Task 6, or directly)
and check the listing renders them only when the plan allows. Premium and Elite
have `showSocialLinks`; Standard and above have `showContactName`.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add "src/app/directory/business/[slug]/page.tsx"
git commit -m "feat(businesses): render contact name and social links

Both were selected on the listing page and never used, so show_contact_name
and show_social_links gated nothing. They are real plan capabilities now."
```

---

### Task 6: Admin form inputs for the new fields

**Files:**
- Modify: `src/components/admin/BusinessForm.tsx`

- [ ] **Step 1: Logo**

Use the existing `<ImageDropzone>` — the same component `bannerImageUrl`
already uses in this file — so the upload path, size limit and preview are
identical.

- [ ] **Step 2: Contact name**

A plain `<Input>` beside the phone and email fields.

- [ ] **Step 3: Social links**

Four `<Input>`s under a "Social Links" heading, registered as
`socialLinks.facebook` and so on. `react-hook-form` builds the nested object.

- [ ] **Step 4: Additional categories**

A multi-select over the categories already fetched for the main dropdown,
excluding whichever is selected as the main category.

**Show the plan cap.** `maxCategories` is enforced on create
(`create/route.ts:134-141`) and must be enforced here too. Show "3 of 5" and
disable adding at the cap — but **always allow removal**, including when the
count already exceeds the cap, or a downgraded business can never clear the
excess.

- [ ] **Step 5: Verify in a browser**

Edit a business, set all four, save, reload. Confirm every value persists —
this is the round trip Task 2 proved at the API level, now through the form.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/admin/BusinessForm.tsx
git commit -m "feat(admin): logo, contact name, social links and extra categories

The admin could not set any of them. Categories show the plan cap and block
adding at the limit, but removal is always allowed so a downgraded business
can clear an over-limit set."
```

---

### Task 7: Final verification

- [ ] **Step 1: Automated**

```bash
npx tsc --noEmit
npm run test:unit
npm run test:integration
npm run lint
npm run build
```

Expected: 0 type errors; all tests pass; eslint no worse than **49 errors /
182 warnings**; the build compiles.

If integration tests fail in a burst with `NeonDbError: fetch failed` across
unrelated files, that is the Neon test branch suspending. Re-run before
investigating.

- [ ] **Step 2: In a browser, as an admin**

Create a business with a tagline and banner — both persist (Task 3). Edit one
and set logo, contact name, social links and extra categories — all persist
(Tasks 2 and 6). View its public listing on a Premium plan and confirm the
contact name and social icons appear; drop it to Free and confirm they do not.

- [ ] **Step 3: Confirm nothing regressed**

The seven existing `canShowFeature` call sites still gate correctly, and a
business with **no** subscription plan still shows no gated fields.

---

## Definition of done

- The admin can set logo, contact name, social links, additional categories and dining type, and the values persist.
- Admin create no longer drops `tagline` or `bannerImageUrl`.
- Contact name and social links render on the listing, gated by their plan flags.
- `canShowFeature` is shared, with its plan-less default covered by a test.
- `tsc` 0 errors, all tests green, eslint no worse than baseline, `next build` compiles.

## What this plan deliberately does not do

- **No owner-facing anything.** No claiming, no owner editor, no pending changes — that is the second plan.
- **No photo gallery.** `business_photos` is a table with no API, no UI and no rows; out of scope by decision.
- **No tagline work.** It is ads/newsletter copy, not a listing field ([[tagline-is-ads-copy-not-a-listing-field]]). Task 3 only stops the create route dropping it.
- **No banner render on the listing.** It is a homepage-ads asset.
