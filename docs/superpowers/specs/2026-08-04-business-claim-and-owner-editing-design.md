# Business claiming and owner editing

**Date:** 2026-08-04
**Status:** Revision 12 — no transactions, count-gated categories, the supersession wording (properly).

Completes the sketch parked in `docs/project-memory/TODO-business-claim-flow.md`.
Decisions carried from 2026-07-31 are marked **(July)**.

## Problem

The paid directory is built and never launched.

| Measured on production, 2026-08-04 | |
|---|---|
| Businesses | 1,635 (1,633 approved) |
| **With an owner account** | **2** — ids 1634 (`pending_payment`) and 1635 (`pending`) |
| Business subscriptions ever created | **0** |
| Owner-facing route for listing fields | **none** — `/api/businesses/[id]` has only a GET |

So 1,633 approved listings are a directory the admin maintains by hand. A shop
that moves premises emails Daniel, who edits it himself.

> **Corrected in revision 2.** An earlier draft said zero listings had owners.
> Two arrived after the July measurement, and **both are unapproved**, which
> makes the "can you claim an unapproved listing" question live data rather than
> hypothetical. Neither owner is trusted.

**The order is claim → edit.** An edit route serves almost nobody while
essentially every listing has a NULL owner **(July)**.

### What already exists for owners

`/api/businesses/[id]` is GET-only for *listing fields*, but five owner-facing
write routes already exist and share one authorization idiom
(`!isAdmin && business.userId !== userId` → 403):

`[id]/non-profit` · `[id]/shoutouts` · `[id]/shoutouts/[shoutoutId]` ·
`[id]/video` · `[id]/video/uploaded`

**This design reuses that idiom rather than inventing one**, and the "My
Business" screen must sit alongside those three existing sub-workflows (video
review, shoutouts, non-profit application), each with its own approval state on
the same row.


## Part 0 — Finish the business fields

**Measured 2026-08-04 from the code and the data, not the schema.** Four of the
six field groups Daniel chose do not fully work today, and a field existing in
`schema.ts` says nothing about whether anything can write it or render it.

| Field | Writable where | Renders on listing | Rows |
|---|---|---|---|
| phone · address · city · postal code | anywhere | yes | most |
| email · website · description | anywhere | yes (plan-gated) | email 1,198 |
| hours | anywhere | yes (plan-gated) | **1** |
| dining type | admin **edit** only | restaurants only | **0** |
| category (main) | anywhere | yes | 1,633 of 1,635 |
| **logo** | **nowhere** | yes (plan-gated) | **0** |
| **contact name** | **user registration only** | selected, never rendered | 1 |
| **social links** | **user registration only** | selected, never rendered | **0** |
| **additional categories** | **user registration only** | no | **0** |
| tagline | user create + admin **edit** (silently dropped by admin create) | **not on the listing** (newsletter shoutouts only) | **0** |
| banner | admin **edit** only (silently dropped by admin create) | **not on the listing** (homepage ads only) | **0** |

Derived by enumerating **all 28 write sites** against the `businesses` table
(`insert`/`update`, `.ts` and `.tsx`), not by reading `schema.ts`. Revision 3 said contact name, social links and additional
categories had no write path; they are written by
`POST /api/businesses/create` and have full UI on the registration form. The
defect is narrower and worse than "missing": they are **create-only**, so a
business sets them at registration and then *nobody* — owner or admin — can ever
change them. The admin update omits the keys, so an edit silently leaves stale
values rather than clearing them.

**A third pattern, found on the fourth pass:** `POST /api/admin/businesses`
validates against `businessSchema` — which accepts `tagline` and
`bannerImageUrl` — and then writes an **explicit field list that omits both**.
An admin creating a business with a tagline gets no tagline and no error. Small,
real, and worth fixing while the edit path is being extended.

**Logo is the genuine gap**: the only reference in the admin create route is a
SELECT, and `businessSchema` does not contain it. Nothing anywhere can set it.

`maxCategories` **is** already enforced against `additionalCategoryIds` on create
(`create/route.ts:134-141`). Revision 3 called the limit "meaningless"; that was
wrong. What is missing is any way to change the categories afterwards.

`show_contact_name` and `show_social_links` are selected on the listing page and
then never used — plan flags gating nothing. `show_kosher_badge` is false on all
four plans, so that badge renders for nobody.

**Daniel's decision: fix these first, as part of this project.** An owner editor
offering a logo that nothing can store, or social links that never appear, would
be the photo-gallery mistake repeated four times.

Required before Part 1:

1. **`logoUrl`** — build the write path: add to `businessSchema`, `BusinessForm`
   and the admin PUT, and to the owner editor. Rendering already exists.
2. **`contactName`, `socialLinks`, `additionalCategoryIds`** — add to the **edit**
   path only; the create path already handles them.
   **`diningType`** joins them: it is written only by the admin PUT, so it has no
   non-admin write path — and it is one of the few fields a Free owner can edit,
   which makes it load-bearing for that tier. `businessSchema` +
   `BusinessForm` + admin PUT + owner editor.
3. **Render `contactName` and `socialLinks`** on the listing, gated on
   `showContactName` and `showSocialLinks` — both flags exist and gate nothing.
4. **Additional categories must affect browsing.** Category browse
   (`directory/[slug]/page.tsx`) and search (`api/directory/search/route.ts`)
   filter on `categoryId` only. Matching inside the JSONB array needs a GIN
   index. Without this, extra categories are decorative — and they are what
   `maxCategories` sells.
5. **`tagline` — decided: not an owner-editable field, and no work here.**
   It was built for homepage ads (`schema.ts:188`, and the admin form still
   promises "will appear in homepage ad placements"). The ads shipped using the
   banner image instead. Its only render is the newsletter shoutout block
   (`newsletter-renderer.ts:183`), which requires Elite. Measured: **0 businesses
   on Elite, 0 shoutouts ever created, 0 taglines set.** Every link in that chain
   is empty.

   It stays the admin's copy for a paid placement. `description` is the field
   owners edit — 1,072 of 1,635 already have one, and the directory card already
   renders it truncated to 150 characters, which is what a tagline would have
   done.

   Separate small fix, not part of this project: the admin form text is wrong and
   should say "used in newsletter shoutouts".

**Banner stays out.** It is a homepage-advertising asset gated on
`show_in_homepage_banner`, not a listing field, and belongs with the ads work.

## Part 1 — Claiming

### Flow

1. An **approved** public listing shows **"Is this your business?"** **(July)**
2. Any logged-in, email-verified user may claim, with an optional message.
   Gate is the existing `assertCanPost` — which also re-checks the account is
   active, and exempts admins from the verification requirement.
3. The claim lands in **Admin → Businesses → Claims**
4. **Daniel approves each by hand** **(July)**, setting `businesses.user_id`

### Only approved listings can be claimed

An unapproved or `pending_payment` listing belongs to whoever is mid-payment;
letting a third party claim it could hand ownership to someone who did not pay.
Unapproved listings 404 publicly in any case, so there is nowhere to put the
link. A genuine owner of an unapproved listing is handled by **admin assignment**
below.

### Verification is deliberately manual

Approving hands over a real listing on the claimant's word plus Daniel
recognising the name — the same trust model as shul managers, judged acceptable
at this scale **(July)**. Emailing a code to the address already on the listing
(1,198 of 1,635 carry one) is the identified upgrade and **needs no schema
change**, which is why it is deferred rather than designed now.

### Cases the shul equivalent does not handle

| Situation | Behaviour |
|---|---|
| Two people claim the same shop | Approving one **auto-rejects the others** with a note |
| The listing already has an owner | Link becomes **"Report a problem with this listing"** — routes to the existing contact form, pre-filled with the business name. **Not a new queue**, no new tab, no new content type |
| The business is not in the directory | Point at the existing "add your business" flow |
| The listing is not approved | No claim link. Admin assigns manually if asked |

### Admin controls ownership directly

- **Assign an owner without a claim** — a shop that phones instead of using the
  site, or a genuine owner of an unapproved listing
- **Revoke an owner** — the business changes hands, or a grant is abused
- **Assigning where an owner already exists** returns **409**, not a silent
  overwrite. Replacing an owner is revoke-then-assign, so the removal is a
  deliberate act rather than a side effect

**Neither has any plumbing today.** `BusinessForm` has no owner field,
`businessSchema` has no `userId` (so the admin PUT would strip it), and the
update never touches `userId`. All three need building. Reuse the existing
`UserPicker`, built for the shul-manager dialog precisely because a
3,000-entry `<Select>` was unusable.

## Part 2 — What an owner may change

### Editable

Contact details (phone, email, website, address, city, postal code, contact
name) · description · hours & dining type · **logo** · social links · categories
(main and additional).

Every one of those is real **only after Part 0**. Tagline and banner are both
excluded — they are ads/newsletter assets, not listing fields.

### Never editable by an owner

**Kosher certification** — a claim about hashgacha the community relies on. A
business asserting its own certification unreviewed is a different order of risk
from a wrong phone number. *(Note: `show_kosher_badge` is false on all four
plans, so the badge currently renders for nobody. Unrelated to this design,
worth knowing.)*

Also fixed: name, slug, subscription plan, featured placement, search priority,
approval status, and the Mux video review fields.

### The photo gallery is out of scope

`business_photos` exists as a **table and nothing else** — no API, no UI, no
rendering, and zero rows. An earlier draft listed "photo gallery" as editable
and cited `maxPhotos` as a limit to enforce; building that means building an
entire subsystem. **Images means logo and banner**, both of which exist and
render today. The gallery becomes its own project.

### Two owner roles

| Role | Behaviour |
|---|---|
| **Ordinary** | Changes queue for review. **The listing stays live and unchanged meanwhile** **(July)** |
| **Trusted** | Changes go live immediately; admin notified who changed what |

Trusted is the existing **`canAutoApproveBusinesses`** flag **(July)**.

> **Supersedes `268b1f1`, which is deployed.** That commit wired
> `canAutoApproveBusinesses` to gate approval of business **creation**, following
> `decisions/2026-08-03-dead-toggles-get-wired-not-removed`. This design uses it
> for **owner edits**, which is what July designed it for. The commit must be
> reworked before this ships, and the reversal recorded as its own decision.
> **Business creation keeps `isTrusted`** — itself marked "legacy, kept for
> backwards compatibility" and set on 22 users who own zero businesses. Leaving
> creation on a legacy flag is a deliberate deferral, not an endorsement.

### The editor shows only what the owner's tier displays

**Daniel's decision, made knowing the consequence.** A Free owner's editor
contains phone, address, city, postal code, dining type and one category.
Description, email, website, hours, logo, social links and **contact name** are
not shown, because Free displays none of them (`show_contact_name` is false on
Free — an earlier draft wrongly listed it as Free-editable).

That is thin, and 1,634 of 1,635 businesses are on Free. It is the tier design
working as intended — those fields are what Standard sells. The accepted cost is
that a Free listing's email and hours will go stale, since the owner has no way
to correct them.

Considered and rejected: showing every field with "displays on Standard and
above". Better data and a live upgrade prompt, but it lets an owner spend time
on fields nobody will see.

### Plan limits

`maxCategories` is **already enforced on write** at
`businesses/create/route.ts:134-141`. The edit path needs the same check —
this is copying an existing rule, not inventing one.

The `show*` flags are display-only gates. Under the decision above they become
editor-visibility rules too — **and server-side rejection rules**. Hiding a field
in the form is not enforcement: the API must reject a value for a field the
caller's plan does not display, exactly as it already rejects too many
categories. The project's standing rule is never to trust the frontend.

**Categories are gated by a count, not a flag — so the tier-visibility rule does
not apply to them.** Every other field is shown or hidden by a boolean `show*`
flag. `additionalCategoryIds` has only `maxCategories`, and a cap of 1 does not
mean "hide the control".

So the additional-categories control is **always present**, showing the cap
("3 of 1 — your plan allows 1"). Adding is blocked at or over the cap; **removing
is always allowed**, and the server accepts a write that shrinks the set even
when the count exceeds the plan. Without that exception a downgraded owner could
never clear the excess, which is the dead end grandfathering exists to prevent.

**Existing over-limit data is grandfathered.** A business downgraded from
Standard (3 categories) to Free (1) keeps its three; the editor blocks *adding*
more but never forces a purge, or the owner hits a dead end they cannot clear.

## Part 3 — The pending change

### A separate table, and why it is not the submissions system

`src/lib/submissions/` is mature and handles eight content types, but
**`businesses` is not one of them and cannot simply be added**: `setApprovalStatus`
requires `broadcastAt` and `rejectionReason` columns, which `businesses` does not
have.

More decisively, that system's model is **overwrite-in-place then unpublish**
(`apply-edit.ts:134-145`). The binding rule here — carried from July — is that
the listing **stays live and unchanged**. Those are incompatible by design, not
by omission.

> **Corrected in revision 2.** An earlier draft justified this by saying
> rejecting an edit "destroys the approved version". That is wrong: rejection
> writes only a status. The content was already gone when the owner pressed
> Save, because the update is in place. **The accurate justification is stronger:
> no proposed-vs-current storage exists for any content type, so an admin
> reviewing an edit today cannot see a diff at all.**

This makes businesses the only type where an edit does *not* unpublish,
diverging from `decisions/2026-07-31-edit-unpublishes-via-pending-edit`. Argued
deliberately: a blog post going dark for a day is a inconvenience; a directory
listing going dark takes a business's phone number off the internet.

**Reuse the single-writer discipline** from `setApprovalStatus` — one function
owns the status transition — but **not `notifySubmitter`**. Its signature is `{ approved: boolean, reason, … }`, and its
link falls back to `/dashboard/submissions` — a page that will never list a
business change — whenever the outcome is not a clean approval. A per-field partial outcome is neither approved nor rejected, and
widening that function would change the shape for all eight existing submission
types.

So: **a business-specific notifier**, taking the outcome map and composing "4 of
your 5 changes are live; Description was not approved because …", linking to
`/dashboard/business/[id]`.

### Shape

Per field: the proposed value, the value at submission time (for the diff), and
after review whether it was applied and any reason.

**Field granularity for structured values.** `hours`, `socialLinks` and
`additionalCategoryIds` are JSONB, not scalars. Each is treated as **one field**
for review — a whole-hours change is approved or rejected together, not
day-by-day. Splitting them would multiply the review surface for no benefit, and
partial hours are more likely to be wrong than useful.

**A second edit replaces the first** — only the owner's latest intent is ever
reviewed.

### Exactly one owner, and the public sees nothing

`businesses.user_id` is a single column, so a listing has **one owner or none**.
There is no co-owner and no second claimant to consider — the question only
arises once delegation ships, which is a separate project and will need its own
answer for who may see a pending change.

**The public listing shows no indication that a change is queued.** No "update
pending" badge, no greyed field. That follows directly from the rule that the
listing stays live and unchanged: a visitor should not be able to tell the
difference between a listing nobody has touched and one with an edit awaiting
review.

Who can see a pending change: **the owner who submitted it** (on their
dashboard) and **the admin** (in the Changes tab). Nobody else, anywhere.

### Review is field by field

Old → new with a tick per field. Approving writes only ticked fields. Each
unticked field takes an **optional** reason — optional because most rejections
are self-evident, and a mandatory sentence is how a queue stops getting cleared.

Rejected: all-or-nothing (throws away four good corrections over one bad field)
and an editable review screen (builds the edit form twice, and rewrites the
owner's words without telling them).

### The owner is told

Which fields went live, which did not, and why where a reason was given. With no
reason they still learn *which* field — enough to try again. Silence was
rejected: an owner who cannot tell whether a change was seen resubmits it.

### Images

Uploads go **directly to Blob storage when the file is picked**, before submit —
so the file exists at a public URL before it reaches the queue. The pending row
stores that URL; approving swaps it onto the listing; **rejecting deletes the
blob**.

Note `/api/upload` DELETE is **admin-only**, so admin rejection can delete but an
owner who replaces their own logo before review, or abandons the form after
uploading, orphans a blob with no cleanup path. **Accepted for now**, recorded so
it is not rediscovered as a surprise.

## Screens and roles

| Role | Sees | Can do | Where |
|---|---|---|---|
| Anonymous | Approved listing **and the claim CTA** | Click → sent to login, returned to the claim form after | Public listing |
| Member, unverified | Listing + claim CTA | Blocked; offered a resend link (`assertCanPost` returns a distinguishable code) | Public listing |
| Member, verified | Listing + claim CTA | Submit a claim | Claim form |
| **Claimant, pending** | Their claim and its status | Wait, or withdraw | `/dashboard/business` (list) |
| **Claimant, rejected** | Rejection and reason | Resubmit | `/dashboard/business` (list) |
| **Claimant, auto-rejected** | "Another claim was approved" | — | `/dashboard/business` (list) |
| Ordinary owner | Listing + pending change | Edit → queue | `/dashboard/business/[id]` |
| Trusted owner | Listing | Edit → live | `/dashboard/business/[id]` |
| Former owner (revoked) | Nothing owned | Claim again | `/dashboard` |
| Admin | Everything | Approve, reject, assign, revoke | Admin → Businesses |

**The dashboard link is shown when the user owns a business OR has a claim in
any state**, not when `role === "business"`. Ownership alone is not enough: a
*pending* claimant owns nothing yet, and the three claimant rows above would be
unreachable.

The role gate would leave an approved claimant owning a listing with no
navigation to reach it. Promoting them to `role: "business"` does not fix it
either: `token.role` is set at sign-in, and the only refresh path is
`update()` — which since `ad81bdb` re-reads from the database rather than
trusting the client, so it is now safe to call but still requires the client to
call it.

**Review is admin-role-only.** There is no `canManageBusinesses` capability and
this design does not add one — deliberate, stated so it is a decision rather than
an omission. It diverges from
`decisions/2026-08-03-atr-capability-not-admin-role`, justified by there being
exactly one reviewer.

### Business owner — two screens, not one

`/dashboard/business` is already a **list** of the user's businesses, and
`/dashboard/business/[id]` is the per-business dashboard where the video
uploader, shoutouts and the non-profit application already live. The editor
belongs on **`[id]`**, alongside those three — putting it on the list page would
break the multi-business case this design explicitly supports.

**`/dashboard/business` — the list**

- **No listing yet** — shows any claim they have made and its state: pending,
  rejected with the reason, or auto-rejected because another claim was approved.
  Resubmission allowed from here.
- **Owns one or more** — the existing list, unchanged.
- **Neither a business nor a claim** — an empty state pointing at the directory:
  "Find your business and claim it."

**`/dashboard/business/[id]` — the editor**

- Fields their plan does not display are absent (see the tier decision).
  Plan-capped counts show the cap.
- **Ordinary owner with a change waiting** — a panel above the form: "Your
  changes are awaiting review", listing each pending field with its proposed
  value. Editing again replaces that change.
- **Trusted owner** — no waiting state; changes are applied on save and the
  admin is notified who changed what. **A row is still written**, with
  `status = 'reviewed'` and an `outcome` marking every field applied. Without it
  "who changed what" survives only in a notification body, and the activity page
  that would otherwise cover this is explicitly out of scope.
- **After review** — an in-app notification and an email naming the fields that
  went live, the fields that did not, and any reason given.

### Admin — Admin → Businesses

Existing: All Businesses · Categories · Plans · Non-Profit · Video Review ·
Shoutouts · Ads. **Adding Claims and Changes makes nine.** Both are **path segments**
(`/admin/businesses/claims`, `/admin/businesses/changes`), matching every
existing tab in `(admin)/admin/businesses/layout.tsx`. This section uses no
query-param tabs. Daniel's call, knowing
the row is crowded and stacks vertically on mobile. Regrouping the section is
separate work.

All Businesses gains an owner column with assign and revoke.

### Notifications

Uses `notifyAdminOfSubmission`. See **Notification identifiers** below for
exactly which registries to touch — and, importantly, which not to.


## Data model

Two new tables. Column lists are the contract; the plan turns them into a
migration.

### `business_claims`

Modelled on `shul_registration_requests`, which is proven.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `business_id` | int NOT NULL → `businesses.id` **ON DELETE CASCADE** | |
| `user_id` | int NOT NULL → `users.id` **ON DELETE CASCADE** | |
| `message` | text NULL | the claimant's optional note |
| `status` | varchar(20) NOT NULL default `pending` | `pending` · `approved` · `rejected` · `auto_rejected` · `withdrawn` |
| `rejection_reason` | text NULL | optional, same rule as change review |
| `reviewed_by` | int NULL → `users.id` ON DELETE SET NULL | |
| `reviewed_at` | timestamp NULL | |
| `created_at` | timestamp NOT NULL default now | |
| `updated_at` | timestamp NOT NULL default now, `$onUpdate` | Note `shul_registration_requests`, the model for this table, has none — this follows the newer convention deliberately |

**Partial unique index** on `(business_id, user_id) WHERE status = 'pending'` —
one open claim per person per listing. A rejected claimant may resubmit, which
creates a new row; the index does not block that because the old row is no longer
`pending`.

Approving one claim sets every other `pending` claim on that business to
`auto_rejected` in the same operation.

### `business_pending_changes`

**One row per submission, not per field.** The alternative — a row per changed
field — was considered and rejected: `hours`, `social_links` and
`additional_category_ids` are JSONB, and an EAV table would stringify them and
lose their types. One row also makes "a second edit replaces the first" a single row
transition rather than a set difference.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `business_id` | int NOT NULL → `businesses.id` **ON DELETE CASCADE** | |
| `submitted_by` | int NULL → `users.id` **ON DELETE SET NULL** | |
| `proposed` | jsonb NOT NULL | `{ field: newValue }` — only changed fields |
| `previous` | jsonb NOT NULL | same keys, values as at submission, for the diff |
| `outcome` | jsonb NULL | after review: `{ field: { applied: bool, reason: string \| null } }` |
| `status` | varchar(20) NOT NULL default `pending` | `pending` · `reviewed` · `superseded` · `discarded`. A trusted owner's (or admin's) save is written directly as `reviewed`; `discarded` is set when the owner is revoked **or** when the listing is un-approved; the owner is told in both cases |
| `reviewed_by` | int NULL → `users.id` ON DELETE SET NULL | |
| `reviewed_at` | timestamp NULL | |
| `created_at` | timestamp NOT NULL default now | |
| `updated_at` | timestamp NOT NULL default now, `$onUpdate` | Mutated on review and on supersede |

**Partial unique index** on `(business_id) WHERE status = 'pending'` — at most one
waiting change per listing, which is what "a second edit replaces the first"
means. Replacement marks the old row `superseded` rather than deleting it, so the
history survives.

`previous` is captured at submission, so a diff always shows what the owner was
looking at. If the admin changed the listing meanwhile, `previous` will not match
the live row — the review screen must show the live value too, and that
divergence is the one the owner never saw.

### Change to an existing column

`businesses.user_id` currently has **no `ON DELETE` clause**
(`schema.ts:171`), so deleting a user who owns a business raises a foreign-key
error. Add **`ON DELETE SET NULL`**. This is an alteration to an existing column
on a 1,635-row table and is a migration step in its own right, not an aside.

*(Note there is no DELETE handler on `/api/admin/users/[id]`, so users cannot be
deleted through any UI today — this is defensive.)*

## API surface

All owner routes reuse the existing idiom: `!isAdmin && business.userId !== userId`
→ 403. All admin routes check the role. Every mutating route calls
`assertCanPost`.

| Route | Method | Who | Purpose |
|---|---|---|---|
| `/api/businesses/[id]/claim` | POST | verified user | Submit a claim |
| `/api/businesses/[id]/claim` | DELETE | claimant | Withdraw own pending claim |
| `/api/user/business-claims` | GET | self | Claims and their status, for the dashboard |
| `/api/admin/business-claims` | GET | admin | The Claims queue |
| `/api/admin/business-claims/[id]` | PATCH | admin | Approve or reject; approving sets `businesses.user_id` and auto-rejects rivals |
| `/api/admin/businesses/[id]/owner` | PUT / DELETE | admin | Assign directly / revoke |
| `/api/businesses/[id]` | PATCH | owner | Submit an edit — queues, or applies directly if trusted |
| `/api/businesses/[id]/pending-change` | GET | owner + admin | The waiting change |
| `/api/businesses/[id]/pending-change` | DELETE | owner | Withdraw it. Without this an owner who submits by mistake can only overwrite it with another edit, since the index permits one pending row and Save is the editor's only action |
| `/api/admin/business-changes` | GET | admin | The Changes queue |
| `/api/admin/business-changes/[id]` | PATCH | admin | Per-field approve; body carries the outcome map |

### Notification identifiers

New `SubmissionContentType` values **`business_claim`** and
**`business_change`**. In-app notifications for all admins are unconditional
(`notifications.ts`, `createAdminNotification`), so both queues reach the bell with no further work.

**No instant email.** A claim is not time-critical, and per-change emails across
1,635 listings would be noise. That means **no `INSTANT_EMAIL_TYPES` entry** —
and consequently **no `FORM_TYPE_BY_CONTENT` entry either**: that map is read in
exactly one place (`notifications.ts:234`), *inside* the instant-email branch, so
an entry without the corresponding `INSTANT_EMAIL_TYPES` membership is dead
config. Adding one to `FORM_TYPES` alone would create a Settings screen for
recipients who never receive anything.

**The daily digest does not pick these up automatically.** An earlier revision
claimed it would; that was wrong. `cron/notification-digest/route.ts` is a
**hardcoded list of eleven `count(*)` queries** feeding a hardcoded `categories`
array. It iterates neither `FORM_TYPES` nor the
`notifications` table. So including the two new queues requires **explicitly
editing that route**: two more count queries and two more `categories` entries,
pointing at `/admin/businesses/claims` and `/admin/businesses/changes`.

*(That cron has never actually run — `CRON_SECRET` is unset and it returns 401 to
Vercel's own scheduler. See `docs/project-memory/SECURITY-FINDINGS-2026-08-04.md` item 1. The digest
work here is worthless until that is fixed.)*

### Approval-time re-validation

Per-field approval can produce a combination the owner never proposed. Before
writing, the approval must re-check:

- **`maxCategories`** against the resulting set — approving `additionalCategoryIds`
  while rejecting `categoryId` can exceed the plan or duplicate a category
- **Category existence** — `additional_category_ids` is JSONB with no referential
  integrity, so a category can vanish between submission and approval
- **Plan gating** — the plan may have changed since submission

A failed re-check blocks that field and shows the reason; it does not fail the
whole review.


## Supporting work the feature depends on

Not obvious from the parts above, but an engineer hits all of these.

### The owner editor needs its own validation schema

**Do not reuse `businessSchema`.** It requires `name`, and it contains
`isFeatured`, `isKosher`, `kosherCertification` and `bannerImageUrl` — every one
on the never-editable list. A `.partial()` of it accepts all of them. It also
does not contain `socialLinks`, `contactName`, `additionalCategoryIds` or
`logoUrl` at all.

New **`ownerBusinessEditSchema`** in `src/lib/validations/content.ts`: exactly the
editable fields, all optional, with the `socialLinks` key set defined (reuse the
shape already in `createBusinessSchema`, which is the only place it exists).

### Nothing currently returns the values the editor must show

The editor lives on `/dashboard/business/[id]`, which calls
**`GET /api/businesses/[id]`** — not `my-businesses`, which serves the list page.

That route returns identity, video, non-profit, **dining type**, the main
category, and four plan flags (`showVideo`, `showShoutouts`,
`showInHomepageBanner`, `showInHomepageSidebar`).

Of the editable fields it returns only those two — dining type and the main
category. Missing: phone, email, website, address, city, postal code,
description, hours, logo, contact name, social links and additional categories.

So there is a **read** path to build as well as the write paths in Part 0.
Extend `GET /api/businesses/[id]` with the editable fields and the remaining
capability flags (`showDescription`, `showEmail`, `showWebsite`, `showHours`,
`showLogo`, `showSocialLinks`, `showContactName`, `maxCategories`). The route
already returns four such flags, so this follows an established shape.

`canShowFeature` is **module-private** inside
`directory/business/[slug]/page.tsx`; extract it so the editor and the
server-side rejection rules share one definition.

**Watch the plan-less default.** `canShowFeature` is `if (!plan) return false`,
while the category limit is `if (plan && plan.maxCategories !== null)` — which
skips the check entirely when there is no plan. Copied verbatim into the edit
path, a business with a NULL `subscriptionPlanId` could edit almost nothing and
add unlimited categories. Decide one rule for plan-less businesses and apply it
to both.

### The `268b1f1` rework breaks existing tests

`tests/dead-permission-toggles.test.ts` contains four assertions that
`canAutoApproveBusinesses` decides business **creation**, with comments
documenting it as the fix for a dead toggle. Reworking the flag to gate edits
means updating that file and `resolveBusinessApprovalStatus`'s signature — the
`canAutoApproveBusinesses` parameter goes away, `BusinessApprovalInput` loses a
field, and creation depends on `isTrusted` alone.

Two pieces of admin-facing copy also describe the old meaning and must change:
the permissions dialog labels the toggle **"Business Listings"** under a heading
about submitting without approval (`UserTable.tsx`), and the module docstring of
`auto-approve-targets.ts` explains all three toggles in terms of creation.

### "Report a problem" cannot pre-fill the contact form as things stand

`src/app/contact/page.tsx` holds its form in local state with no
`useSearchParams` and no prefill path, and its `CONTACT_CATEGORIES` list has no
business/listing entry.

**Decision: link to `/contact` with no pre-fill**, and add a "Business listing"
category. Pre-filling is a change to a page this project otherwise does not
touch, for a link nobody has asked for yet.

### An owner whose listing is not approved

**This is the only state the feature ships into.** Both businesses that have an
owner today are unapproved — 1634 `pending_payment`, 1635 `pending`.

Part 3's premise, that the listing "stays live and unchanged", does not apply to
a listing that is not live. So for a listing whose `approvalStatus` is anything
other than `approved`, an owner's edit is **written straight to the row**, with
no pending change and no review — it is already sitting in the creation-approval
queue, and a second queue on top of it would mean the admin approving the same
listing twice.

The pending-change machinery applies only to **approved** listings.

### The claim CTA and what it costs

The CTA has four viewer-dependent states — claim · "awaiting review" · "report a
problem" · nothing — so it depends on the session and a claims lookup. Today the
listing page calls `auth()` only inside its not-publicly-visible branch.

**Render the CTA as a client component with its own fetch**, leaving the page
itself server-rendered and cacheable. Server-rendering it would make the listing
per-viewer and moot the `revalidatePath` rule below.

**The claim form is a modal on the listing page**, opened by `?claim=1`. That
gives the login redirect a `callbackUrl` to return to — `LoginForm` already
honours one — without inventing a separate route for a form with one optional
field.

**Claimable means approved AND `isActive`.** The public page requires both, so an
approved-but-deactivated listing has no page to put the link on. The API check
must match the CTA rule, not just `approvalStatus`.

### Claim outcomes are notified too

Approve, reject and auto-reject each notify the claimant — in-app and email —
using the same business-specific notifier. Without this the claimant learns their
outcome only by revisiting the dashboard, which is the silence problem already
rejected for change review.

### Claim states the spec created but did not resolve

- **A user with a pending claim** sees "Your claim is awaiting review" on the
  listing, not the claim CTA. The route must check before inserting, or the
  partial unique index surfaces as a raw constraint error.
- **Withdrawn claims** may be re-submitted — the index only blocks a second
  *pending* row. A withdrawn claim disappears from the dashboard.

### Dining type is gated by category, not by plan

Every other editor-visibility rule is a tier rule. Dining type is not: it renders
only when `category.isRestaurant`, and `BusinessForm` already nulls it for
non-restaurant categories.

So a Free owner sees the field **only if their category is a restaurant**, the
server rejects a `diningType` value for a non-restaurant category, and
**approval-time re-validation must include it** — per-field approval could
otherwise approve a dining type while rejecting the category move that justified
it, leaving a dining type on a non-restaurant listing.

### The digest queries do not follow the existing pattern

Ten of the eleven existing counts in `cron/notification-digest/route.ts` read
`approval_status`; the eleventh (business videos) reads
`video_status = 'ready' AND video_approval_status = 'pending'`. The two new ones read **`status = 'pending'`** on the new
tables instead, so the pattern does not transfer verbatim. Note also that
`categories` is filtered on `count > 0`, so an empty queue correctly contributes
nothing.

### There are no transactions

`src/lib/db/index.ts` uses `neon()` HTTP with `drizzle-orm/neon-http`.
**`db.transaction` does not exist** — the only mention in `src/` is a comment
explaining its absence. Two places in this design read as atomic and are not:

- **Approving a claim** sets the owner and auto-rejects rival claims. Order:
  auto-reject rivals **first**, then set the owner. A failure between them leaves
  rivals rejected and no owner — recoverable by approving again. The reverse
  order can leave two people believing they own the listing.
- **Approving a change** writes the listing row, the `outcome` map and the
  status. Order: **outcome and status first, then the listing row.** A failure
  between them leaves a change marked reviewed whose values did not land — 
  visible and re-appliable — rather than a silently-changed listing the owner is
  never told about.

This matches the existing precedent: `applyEdit` and `setApprovalStatus` are two
unguarded round trips for the same reason.

### Cache invalidation on approval

`directory/business/[slug]/page.tsx` exports no `dynamic` or `revalidate`, and
neither the admin business route nor `businesses/create` calls
`revalidatePath`. Approving a change writes to the live row with nothing
invalidating the public page. **All three paths that write the live row must `revalidatePath` the listing**:
admin approval of a change, a trusted owner's direct save, and an
unapproved-listing owner edit — the last because that listing becomes public
later. The project already does this for simchas and shul documents.

### `createBusinessSchema` has to move

`ownerBusinessEditSchema` belongs in `src/lib/validations/content.ts`, but the
`socialLinks` shape it should reuse is a **local const** in
`api/businesses/create/route.ts` — not exported, not in `content.ts`. Moving it
touches the create route.

### An admin using the owner PATCH

The reused idiom (`!isAdmin && business.userId !== userId`) means an admin may
PATCH any business. An admin is not necessarily a trusted *owner*, so under the
literal rule an admin's edit would queue for the admin to review.
`decisions/2026-07-31-admins-auto-approve-every-type` settles the general case:
**an admin's edit applies immediately**, exactly like a trusted owner's.

### Other tests this touches

Beyond `dead-permission-toggles.test.ts`: `resolveBusinessApprovalStatus`'s
signature change reaches its call site in `businesses/create/route.ts`, and
`tests/unit/notify-admin.test.ts` asserts tier routing per content type — two
types in neither `INSTANT_EMAIL_TYPES` nor `FORM_TYPE_BY_CONTENT` is a shape it
does not currently cover.

### Empty and loading states

Both new admin tabs will be **empty on day one** — zero claims and zero changes
exist. Each needs an empty state, not a bare table. The editor shows a skeleton
while `my-businesses` resolves.

### Reaching the new screens

`dashboard/page.tsx:222` currently gates its business link on
`role === "business" || role === "admin"`. Replacing that with "owns a business
or has a claim" means the page must also fetch claims; it fetches businesses
only today.

## Lifecycle rules

| Event | Rule |
|---|---|
| Business hard-deleted | Claims and pending changes `ON DELETE CASCADE`. `businesses` deletion is a hard delete today |
| Owner revoked with a change pending | The pending change is discarded and the owner told |
| User deleted while owning a business | `businesses.user_id` has **no `onDelete` clause** — add `SET NULL`, or deleting the user raises an FK error |
| Plan downgraded below current content | Existing data grandfathered; adding beyond the new limit blocked |
| Listing crosses the approved boundary while a change waits | Un-approving a listing **discards** its pending change — the owner now edits straight through, so a queue is meaningless. Approving a listing leaves nothing queued, since its owner was writing straight through |
| Pending change names a deleted category | Validated **at approval time**; `additional_category_ids` is JSONB with no referential integrity, so this is already possible today |
| One user, many businesses | Supported; `my-businesses` already returns a list |

## On completion

Two new decision records — the claims table and the pending-changes model — plus
an `INDEX.md` row for each. The `268b1f1` reversal is already filed as
`2026-08-04-auto-approve-businesses-gates-edits-not-creation`.

## Out of scope

- **Delegation** — an owner inviting others to help manage the listing, and the
  same for shuls. Separate project.
- **The activity page** — `audit_log`, its admin page and `logAudit()` all exist
  and have **never recorded a row**. Separate project.
- **The photo gallery** (see Part 2).
- **Email-code verification** of claims (see Part 1).

## Risks

**The trust model.** A hand-approved claim hands over a live listing. Accepted at
this scale; revocation is the backstop.

**Nobody has used the payment flow.** Zero subscriptions have ever been created,
so the plan-limit paths this depends on are unexercised in production. Business
1634 — one of the two owned listings — is on **Standard**, pending payment; every
other listing is Free. So Free is what almost every owner gets, and under the
editor decision above that is a thin editor.

**`268b1f1` must be reworked before this ships**, or `canAutoApproveBusinesses`
means two different things.

## Decisions

| Decision | Choice |
|---|---|
| Order | Claim first **(July)** |
| Verification | Admin by hand; email codes deferred **(July)** |
| Who may claim | Any logged-in, email-verified user |
| Claimable listings | **Approved only**; admin assigns for the rest |
| Editable fields | Contact, description, hours, **logo**, social, categories. **Banner and tagline excluded** — both are ads/newsletter assets, not listing fields |
| Excluded | Kosher certification; photo gallery (does not exist) |
| Owner roles | Ordinary and trusted (`canAutoApproveBusinesses`) **(July)** |
| Free-tier editor | **Shows only what the tier displays** |
| Over-limit data | Grandfathered; adding blocked |
| Pending storage | Separate table; live row untouched **(July)** |
| Repeat edits | Replace the waiting change |
| Review granularity | Per field, optional per-field reason |
| Owner feedback | Named fields and reasons; resubmission allowed |
| Rejected images | Blob deleted (admin path only) |
| Admin controls | Approve, reject, assign directly, revoke |
| Admin location | **Two new tabs, nine total** |
| Dashboard link | Shown on **ownership**, not role |
| Reviewer capability | **None — admin role only**, deliberately |
