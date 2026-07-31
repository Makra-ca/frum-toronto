# TODO — let businesses claim and manage their own listing

**Status:** designed to about 60%, deliberately parked 2026-07-31. Nothing built.
**Why it matters:** 1,633 listings, none owned by anyone, no revenue, and only
the admin can keep any of them accurate.

## The finding that started it

Measured on production, 2026-07-31:

- **1,633 businesses, 0 with an owner account.** `user_id` is NULL on every
  row. 1,632 from the legacy import, 1 created this year.
- **0 business subscriptions have ever been created.** Plans exist (Free,
  Standard $27, Premium $65, Elite $120), the registration flow exists, the
  PayPal integration exists. Nobody has been through it.
- **`/api/businesses/[id]` has only a GET.** No owner-facing edit route, no edit
  page in the owner's dashboard. Only the admin route can change a listing.

So the paid directory is built and never launched. A business that moves
premises emails the admin, who edits it by hand.

**The order has to be claim → edit → permission.** Building the edit route first
serves nobody: there is no one to grant it to.

## Decisions already made (Daniel, 2026-07-31)

| Question | Answer |
|---|---|
| What is claiming *for*? | The owner takes charge of their listing AND the directory stays accurate. Not primarily a sales funnel. |
| How is a claim verified? | **The admin approves each one by hand**, like shul registration requests today. |
| What may an owner change? | **Two roles** — see below. |
| How do they find their listing? | An **"Is this your business?" link on the public listing page** itself. |
| What does the public see while an ordinary owner's edit waits? | **The old version stays live.** The listing must never disappear because someone corrected their hours. |

### The two roles — Daniel's point, and the important one

Not every owner should be equal:

- **Ordinary owner** — may edit, but changes wait for admin confirmation.
- **Trusted owner** — changes go live immediately, with an audit trail.

**This is exactly what `canAutoApproveBusinesses` was always meant to be.** That
toggle is currently in the admin permissions dialog, saves correctly, and is
read by no code at all — we nearly deleted it as dead. It is not dead; it was
built before the feature it gates. It becomes live the day this ships.

## Design sketched so far

### Claiming

`business_claims`, a near-copy of the proven `shul_registration_requests`:

```
id, business_id, user_id, message, status (pending|approved|rejected),
reviewed_by, reviewed_at, review_notes, created_at
```

Flow: link on the public listing → claim with an optional note → admin queue
under Admin → Businesses → approve sets `businesses.user_id`.

Three cases the shul version does not handle and this one must:

- **Two people claim the same shop** — approving one auto-rejects the others
  with a note.
- **The listing already has an owner** — the link becomes "Report a problem
  with this listing" rather than offering a claim nobody can grant.
- **The business is not in the directory at all** — point them at the existing
  "add your business" flow rather than dead-ending.

**Known weak point, flagged not solved:** approving a claim hands over a real
listing on the strength of the claimant's word and the admin recognising the
name. Same trust model as shul managers, fine at this scale. The natural
upgrade is emailing a code to the address already on the listing; the claim
table would not change.

### Not yet designed

- **What exactly an owner may edit**, and how plan-gated fields (logo, photos,
  banner) interact — a Free-tier owner should not be able to set a logo their
  plan does not include.
- **How a pending change is stored.** Leading option: a
  `business_pending_changes` table holding the proposed fields as JSONB, so the
  live row is untouched until approval and the admin sees old-vs-new side by
  side. Alternatives considered and weaker: duplicating the row as a draft, or
  a `pending_changes` JSONB column on `businesses` (no history).
- **The audit trail for trusted owners.** Shuls already do this: edit goes
  live, admin gets an in-app notification naming who changed what
  (`notifyAdminOfSubmission` with `shul_edit`). Copy that shape.
- Whether trust is per-user or per-business. `canAutoApproveBusinesses` is on
  the user, which is simpler and probably right.

## Where to pick this up

Continue the brainstorm at "Part 2 — what owners can edit, and the
trusted/ordinary split", then "Part 3 — how pending changes are stored and
reviewed". Then a spec, then a plan.

Related decisions:
- `decisions/2026-07-31-business-claim-is-the-missing-step.md`
- `decisions/2026-07-31-business-owners-cannot-edit-their-listing.md`
