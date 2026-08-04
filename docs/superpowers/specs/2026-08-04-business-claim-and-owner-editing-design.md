# Business claiming and owner editing

**Date:** 2026-08-04
**Status:** Design approved by Daniel, pending review

Supersedes the parked sketch in `docs/project-memory/TODO-business-claim-flow.md`,
which this completes. Decisions carried forward from 2026-07-31 are marked
**(July)**.

## Problem

The paid directory is built and never launched.

| Measured on production | |
|---|---|
| Businesses | 1,635 (1,633 approved) |
| **With an owner account** | **0** — `user_id` is NULL on every row |
| Business subscriptions ever created | **0** |
| Owner-facing edit route | **none** — `/api/businesses/[id]` has only a GET |

So 1,633 listings are a directory the admin maintains by hand. A shop that moves
premises emails Daniel, who edits it himself. There is no way for a business to
correct its own phone number, and no way to grant that ability, because there is
nobody to grant it to.

**The order is claim → edit.** An edit route serves nobody while every listing
has a NULL owner **(July)**.

## Part 1 — Claiming

### Flow

1. A public listing page shows **"Is this your business?"** **(July)**
2. Any logged-in, email-verified user may submit a claim with an optional
   message. Verification is the existing `assertCanPost` rule — no new gate.
3. The claim lands in **Admin → Businesses → Claims**
4. **Daniel approves each by hand** **(July)**, which sets `businesses.user_id`

### Verification is deliberately manual

Approving hands over a real listing on the claimant's word plus Daniel
recognising the name — the same trust model as shul managers, judged acceptable
at this scale **(July)**.

Emailing a code to the address already on the listing is the identified upgrade
(1,198 of 1,635 listings carry an email). **The claim table does not change to
add it later**, which is why it is deferred rather than designed now.

### Three cases the shul equivalent does not handle

| Situation | Behaviour |
|---|---|
| Two people claim the same shop | Approving one **auto-rejects the others** with a note explaining the listing was claimed |
| The listing already has an owner | The public link becomes **"Report a problem with this listing"** — never offer a claim nobody can grant |
| The business is not in the directory | Point at the existing "add your business" flow rather than dead-ending |

### Admin also controls ownership directly

- **Assign an owner without a claim.** A shop that phones instead of using the
  site. Mirrors shul manager assignment.
- **Revoke an owner.** A business changes hands, a manager leaves, or a grant is
  abused. Without this a mistaken grant is only undoable in the database.

## Part 2 — What an owner may change

### Editable

Contact details (phone, email, website, address, city, postal code, contact
name) · description & tagline · hours & dining type · images (logo, banner,
photo gallery) · social links · categories.

### Never editable by an owner

**Kosher certification** — a claim about hashgacha the community relies on. A
business asserting its own certification unreviewed is a different order of risk
from a wrong phone number.

Also fixed: name, slug (the listing's identity), subscription plan, featured
placement, search priority, approval status, and the Mux video review fields.

### Two owner roles

| Role | Behaviour |
|---|---|
| **Ordinary** | Changes queue for review. **The listing stays live and unchanged meanwhile** **(July)** |
| **Trusted** | Changes go live immediately; admin notified who changed what |

Trusted is the existing **`canAutoApproveBusinesses`** flag, which was built for
exactly this and has never been read by any code **(July)**.

> **Correction to `268b1f1` (2026-08-03).** That commit wired
> `canAutoApproveBusinesses` to gate approval of business *creation*. That is not
> what it was designed for, and it conflicts with this document. The commit is
> unpushed and must be reworked to gate *edits* before this ships. Business
> creation keeps its existing `isTrusted` behaviour.

### Plan limits are enforced on save

`maxCategories`, `maxPhotos`, `showLogo`, `showSocialLinks` and the rest are
currently enforced **only on display** — nothing stops the data being written,
it simply does not render.

Once owners can edit, that becomes a bug they experience: upload a logo, see
"saved", visit the page, no logo. So the owner's editor **disables** unavailable
fields with the reason ("Logo is available on Standard and above"), and the API
**rejects** values beyond the plan. It doubles as an upgrade prompt.

Live limits: Free 1 category / 0 photos · Standard 3 / 5 · Premium 5 / 15 ·
Elite 100 / 999.

## Part 3 — The pending change

### The live row is never touched

A separate table holds proposed values until they are reviewed. This is forced
by the "listing stays live" rule **(July)** and it avoids repeating the defect
already open on events, where an edit overwrites the approved row and rejecting
destroys it.

Each pending change records, per field: the proposed value, the value at
submission time (for the side-by-side), and after review, whether that field was
applied and any reason.

### A second edit replaces the first

An owner who spots another mistake before review submits again, and the new
submission **replaces** the waiting one. Only their latest intent is ever
reviewed. Avoids approving a stale edit after a newer one.

### Review is field by field

Each changed field shows old → new with a tick. Approving writes only the ticked
fields to the listing. Each unticked field takes an **optional** reason.

Optional matters: most rejections are self-evident, and forcing a sentence every
time is how a queue stops getting cleared.

**Rejected alternatives.** All-or-nothing rejection throws away four good
corrections because of one bad field, leaving the address wrong until they
resubmit. An editable review screen (admin fixes the text and approves) requires
building the full edit form twice, and rewrites the owner's words without telling
them — already an open complaint on the project's threads list.

### The owner is told what happened

Which fields went live, which did not, and the reason where one was given. With
no reason they still learn **which** field, which is enough to try again — they
know what they wrote.

Silence was rejected: an owner who cannot tell whether a change was seen
resubmits it, so silence generates the work it appears to save.

### Images

Uploads go directly to Blob storage when the owner picks the file, before the
form is submitted — so by the time a change reaches the queue **the file already
exists at a public URL**. The pending row stores that URL.

Approving swaps the URL onto the listing. **Rejecting deletes the blob**, or
every rejected logo is billed storage pointing at nothing — the same orphaned-
asset problem the Mux audit found. The deletion helper already exists.

A trusted owner's image changes go live with everything else of theirs.

## Screens

### Public
- **Listing page** — "Is this your business?" (unowned) / "Report a problem"
  (owned)
- **Claim form** — pick nothing; the listing is known. Optional message.

### Business owner — dashboard
- **My Business** — the editor. Plan-unavailable fields disabled with the reason.
  Ordinary owners see "your changes are awaiting review" with what is pending;
  trusted owners see changes applied immediately.
- **Notification + email** on review, naming fields and reasons.

### Admin — under Admin → Businesses, as new tabs
Matching the existing shape of All Shuls | Requests | Managers.

- **All Businesses** *(exists)* — gains an owner column and assign/revoke
- **Claims** *(new)* — queue; approve sets the owner and auto-rejects rival claims
- **Changes** *(new)* — pending changes; per-field tick, per-field optional reason
- **Categories, Plans** *(exist, unchanged)*

Admin notification and email on a new claim and on a new pending change, via the
existing `notifyAdminOfSubmission` path. A trusted owner's live edit produces an
in-app notification naming who changed what, copying the shul pattern **(July)**.

## Out of scope

- **Delegation** — an owner inviting others to help manage the listing. Agreed as
  a separate project, along with the same for shuls.
- **The activity page** — every change and who made it. The `audit_log` table,
  admin page and helper all exist and have **never recorded a row**; wiring it is
  its own project.
- **Email-code verification** of claims (see Part 1).

## Risks

**The trust model.** A hand-approved claim hands over a live listing. Accepted
deliberately at this scale, and revocation exists as the backstop.

**Nobody has used the payment flow.** 0 subscriptions have ever been created, so
the plan-limit paths this design depends on are unexercised in production. Free
is the only tier any real owner will have on day one.

**`268b1f1` must be reworked before this ships**, or `canAutoApproveBusinesses`
means two different things.

## Decisions

| Decision | Choice |
|---|---|
| Order | Claim first; editing is useless without an owner **(July)** |
| Verification | Admin by hand; email codes deferred **(July)** |
| Who may claim | Any logged-in, email-verified user |
| Editable fields | Six groups; kosher certification excluded |
| Owner roles | Ordinary (queued) and trusted (`canAutoApproveBusinesses`) **(July)** |
| Plan limits | Enforced on save, with the reason shown |
| Pending storage | Separate table; live row untouched **(July)** |
| Repeat edits | Replace the waiting change |
| Review granularity | Per field, with optional per-field reason |
| Owner feedback | Named fields and reasons; resubmission allowed |
| Rejected images | Blob deleted |
| Admin controls | Assign directly and revoke, as well as approve claims |
| Admin location | Tabs under Admin → Businesses |
