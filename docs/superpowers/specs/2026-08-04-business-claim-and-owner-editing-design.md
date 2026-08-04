# Business claiming and owner editing

**Date:** 2026-08-04
**Status:** Revision 3 — scope expanded after measuring which fields actually work

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

| Field | Admin can write? | Renders on listing? | Rows with data |
|---|---|---|---|
| phone · address · city · postal code | yes | yes | most |
| email · website · description | yes | yes (plan-gated) | email 1,198 |
| hours | yes | yes (plan-gated) | **1** |
| dining type | yes | restaurants only | — |
| category (main) | yes | yes | all |
| **logo** | **no write path** | yes | **0** |
| **contact name** | **no write path** | selected, never rendered | 1 |
| **social links** | **no write path** | selected, never rendered | **0** |
| **additional categories** | **no write path** | no | **0** |
| tagline | yes | **not on the listing** (newsletter shoutouts only) | **0** |
| banner | yes | **not on the listing** (homepage ads only) | **0** |

`show_contact_name` and `show_social_links` are selected on the listing page and
then never used — plan flags gating nothing. `show_kosher_badge` is false on all
four plans, so that badge renders for nobody.

**Daniel's decision: fix these first, as part of this project.** An owner editor
offering a logo that nothing can store, or social links that never appear, would
be the photo-gallery mistake repeated four times.

Required before Part 1:

1. **`logoUrl`** — add to `businessSchema`, `BusinessForm` and the admin PUT.
   Rendering already exists, gated on `showLogo`.
2. **`contactName`** — add the write path, and render it gated on
   `showContactName`, which exists and is unused.
3. **`socialLinks`** — add the write path, and render gated on
   `showSocialLinks`.
4. **`additionalCategoryIds`** — add the write path and render the extra
   categories. This is what `maxCategories` gates, so the limit is meaningless
   without it.
5. **`tagline`** — writable already; decide whether it renders on the listing or
   stays a newsletter-only field. If it stays newsletter-only it is **not** an
   owner-editable listing field.

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

Every one of those is real **only after Part 0**. Tagline is included only if
Part 0 gives it a home on the listing. Banner is excluded — it is an ads asset.

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

> **Supersedes `268b1f1` (unpushed).** That commit wired
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

Tagline appears only if Part 0 makes it render.

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

**Reuse where it does fit:** the single-writer discipline and submitter-
notification path from `setApprovalStatus`, rather than growing a parallel one.

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
| **Claimant, pending** | Their claim and its status | Wait, or withdraw | **`/dashboard/business`** |
| **Claimant, rejected** | Rejection and reason | Resubmit | **`/dashboard/business`** |
| **Claimant, auto-rejected** | "Another claim was approved" | — | **`/dashboard/business`** |
| Ordinary owner | Listing + pending change | Edit → queue | `/dashboard/business` |
| Trusted owner | Listing | Edit → live | `/dashboard/business` |
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

### Business owner — `/dashboard/business`

The screen this project exists to build.

- **No listing yet** — shows any claim they have made and its state: pending,
  rejected with the reason, or auto-rejected because another claim was approved.
  Resubmission allowed from here.
- **Owns a listing** — the editor. Fields their plan does not display are absent
  (see the tier decision). Plan-capped counts show the cap.
- **Ordinary owner with a change waiting** — a panel above the form: "Your
  changes are awaiting review", listing each pending field with its proposed
  value. Editing again replaces that change.
- **Trusted owner** — no waiting state; changes are applied on save and the
  admin is notified who changed what.
- **After review** — an in-app notification and an email naming the fields that
  went live, the fields that did not, and any reason given.

### Admin — Admin → Businesses

Existing: All Businesses · Categories · Plans · Non-Profit · Video Review ·
Shoutouts · Ads. **Adding Claims and Changes makes nine.** Daniel's call, knowing
the row is crowded and stacks vertically on mobile. Regrouping the section is
separate work.

All Businesses gains an owner column with assign and revoke.

### Notifications

Uses `notifyAdminOfSubmission`, which requires new entries in
`SubmissionContentType`, `FORM_TYPE_BY_CONTENT`, and `FORM_TYPES` — the last
being what populates the Admin → Settings recipients UI, without which nobody
can configure who receives claim and change emails.

## Lifecycle rules

| Event | Rule |
|---|---|
| Business hard-deleted | Claims and pending changes `ON DELETE CASCADE`. `businesses` deletion is a hard delete today |
| Owner revoked with a change pending | The pending change is discarded and the owner told |
| User deleted while owning a business | `businesses.user_id` has **no `onDelete` clause** — add `SET NULL`, or deleting the user raises an FK error |
| Plan downgraded below current content | Existing data grandfathered; adding beyond the new limit blocked |
| Pending change names a deleted category | Validated **at approval time**; `additional_category_ids` is JSONB with no referential integrity, so this is already possible today |
| One user, many businesses | Supported; `my-businesses` already returns a list |

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
| Editable fields | Contact, description, hours, logo/banner, social, categories |
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
