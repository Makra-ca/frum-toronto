# Security findings — 2026-08-04

**Status as of 2026-08-06: items 0–11 are fixed; item 12 is partly fixed.**
Details are recorded under each finding and summarised at the bottom. The Low
list is untouched.

**How this started.** A design spec of mine claimed "`token.role` is only set at
sign-in". A reviewer checked it, found it false, and that led to a live privilege
escalation (item 0). A follow-up sweep of all 198 API routes produced the rest.

**Verification key.** Each finding is marked:

- **VERIFIED BY ME** — I read the code and confirmed the logic, or ran the exploit
- **AGENT-PROVEN** — a review agent ran a probe against production and reported the response
- **REPORTED** — found by the sweep, code cited, not independently re-run by me

Nothing here is theoretical unless it says so.

---

## 0. Client-supplied role became an admin token — FIXED, DEPLOYED

**Status: fixed in `ad81bdb`, pushed and live.** Recorded for completeness.

`src/lib/auth/auth.ts` jwt callback:

```ts
if (trigger === "update" && session) {
  token.role = session.role;        // `session` is the client's POST body
  token.isTrusted = session.isTrusted;
}
```

**VERIFIED BY ME — exploited end to end.** A plain `member`:

```
POST /api/auth/session  {"data":{"role":"admin","isTrusted":true}}   → 200
session role   member → admin
/admin              307 blocked → 200
/api/admin/users              → 200
```

`middleware.ts`, `auth.config.ts` and ~101 admin API routes all trust that one
token field. Any of 3,100+ accounts could have done it with one request.

Fix: the payload is ignored; claims are re-read from the database
(`src/lib/auth/user-claims.ts`). Re-ran the identical request afterwards — role
stayed `member`, `/admin` 307, admin API 401. The legitimate use of `update()`
(picking up a role granted mid-session) still works.

---

## 1. All four cron endpoints are unauthenticated — ANONYMOUS, LIVE

**Severity: highest remaining. No account needed.**

`CRON_SECRET` **does not exist** — absent from `.env`, and absent from Vercel
production. **VERIFIED BY ME.**

Two different broken guards result. **VERIFIED BY ME (code):**

```ts
// tehillim-cleanup:15, newsletter-send:45  — FAIL OPEN
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
// cronSecret is undefined → falsy → the whole check is skipped

// cleanup-notifications:12, notification-digest:30 — requires a literal string
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
// → the required header is exactly "Bearer undefined"
```

**AGENT-PROVEN against production** (probes chosen to have no side effect — the
agent first confirmed 0 notifications older than 30 days and an empty
`newsletter_sends`):

```
GET /api/cron/cleanup-notifications                            → 401
GET /api/cron/cleanup-notifications -H "Bearer undefined"      → 200
GET /api/cron/newsletter-send        (no header at all)        → 200
```

**What an attacker gains:** trigger the notifications `DELETE`, drive newsletter
batch sending against Resend (cost, and reputation if it sends), and force the
admin digest email.

**Second consequence, arguably worse day to day:** Vercel only sends the
authorization header when `CRON_SECRET` is set. So `cleanup-notifications` and
`notification-digest` have been returning **401 to Vercel's own scheduler** since
they were written. **The daily digest has never been delivered.**

**Fix shape:** set `CRON_SECRET` in Vercel and `.env`, then normalise all four
guards to fail closed — reject when the secret is missing rather than skipping
the check. Redeploy (env changes are inert until then).

---

## 2. Any member can self-assign the $120/mo Elite plan — LIVE

**VERIFIED BY ME.** `src/app/api/businesses/create/route.ts`:

```ts
subscriptionPlanId: z.number().optional(),   // :47  client-supplied
pendingPayment: z.boolean().optional(),      // :49  client-supplied
...
subscriptionPlanId: planId || null,          // :178 written straight through
```

The plan row is loaded, but only to check `maxCategories`. **Nothing compares the
plan's price against `pendingPayment`, and no `businessSubscriptions` row is
required** — grep for `businessSubscriptions` or `price` in that file returns
nothing.

POST with `subscriptionPlanId: 5` (Elite, $120/mo) and `pendingPayment` omitted →
`resolveBusinessApprovalStatus` returns `"pending"`, i.e. the **ordinary review
queue**, so the approving admin sees no indication the tier was never paid for.

Elite grants shoutouts, homepage banner **and** sidebar, 999 photos, 100
categories. Every downstream gate reads the joined plan row rather than an active
subscription.

**The correct pattern already exists**, in exactly one place:
`businesses/[id]/shoutouts/route.ts:190-197` additionally requires an active
subscription. That check is missing everywhere else.

---

## 3. Specials can be published under any business's name — LIVE

**REPORTED**, code cited. `src/app/api/specials/route.ts:104-118` verifies the
business **exists** but never compares `businesses.userId` to the session user.
`userId` appears in the file only for the permission lookup and as the submitter
stamp.

`specials/can-submit/route.ts:38-50` hands the client **all 1,633 approved
businesses** as the dropdown.

Exploitable by any holder of `canPostSpecials`. Gain: promotional content
published under a competitor's brand.

Every other business-scoped route uses `!isAdmin && business.userId !== userId`.
This is the sole outlier.

---

## 4. Blog edit corrupts another user's post URL — LIVE

**REPORTED**, code cited. `src/app/api/user/blog/[id]/route.ts:153-156` runs
`UPDATE ... SET slug` scoped only by `eq(blogPosts.id, postId)`. The ownership
check lives in `applyEdit`, which runs **after**.

So `PATCH /api/user/blog/{any id}` with a new title rewrites that post's slug,
**then** returns 403. The write is already committed — neon-http has no
transactions. Public reads are by slug, so this permanently 404s any of the 3,058
posts, repeatably.

Any logged-in member. The ordering is deliberate and commented; the ownership
consequence was missed.

---

## Medium — all fixed 2026-08-06 (item 12 partly)

| # | Finding | Note | Fix |
|---|---|---|---|
| 5 | **Shiurim have no shul-ownership check and publish instantly** | `shiurim/route.ts:210,245` — `shulId` written raw, `approvalStatus` omitted from the insert so it takes the schema default `approved`. `community/events/route.ts:48-56` does it correctly | `canUserManageShul` now gates `shulId`, admins exempt, matching the events route. `approvalStatus: "approved"` is now stated rather than inherited from the column default — publishing at once is right here (only admins and permission-holders reach the insert) but it should say so. `tests/shiurim-shul-ownership.test.ts` |
| 6 | **ATR comment delete fails open on a stale claim** | The DB fallback runs only when the token says `false`; a `true` token is never re-checked. Not forgeable since item 0 is fixed, but revoking the capability doesn't bite until the token refreshes | Defers to the shared `canManageAtr(session)`, which always resolves from the database. One definition of "ATR manager" instead of two |
| 7 | **Open redirect in newsletter click tracking** | `newsletter/track/click/route.ts` — `new URL()` validates syntax, not destination. Agent verified live: `?url=…` 307s to an arbitrary host from your domain. Phishing that passes a domain check, aimed at a list trained to click | Destination now carries an HMAC minted at send time (`src/lib/newsletter/click-signature.ts`, `NEXTAUTH_SECRET`). A host allowlist was rejected — newsletters link to arbitrary business sites, so there is no list to write. **Zero cost to existing mail: 0 newsletter sends and 0 recipient logs exist**, so no pre-signature link is in anyone's inbox. Also removed a double `decodeURIComponent` that corrupted any destination containing a literal `%`. `tests/unit/newsletter-click-signature.test.ts` |
| 8 | **Shul document URL allowlist is create-only** | `shuls/[id]/documents/[docId]/route.ts:29` uses `z.string().url()`, which accepts `data:` and `javascript:` URLs. The value renders into an `<iframe src>` on the public shul page. The create route deliberately uses `isUploadedImageUrl` and comments on why. Same create-only bug already fixed once for shiva `attachmentUrl` | Edit schema now uses the same `isUploadedImageUrl` refine as create. **Third instance of this exact shape** (shiva `attachmentUrl`, blog slug, this): a control applied on create and skipped on edit. `tests/shul-document-edit-guards.test.ts`, verified red against the old code |
| 9 | **ATR submit takes name and email from the body** | `userId` is session-derived correctly, but the displayed identity and the admin `replyTo` are attacker-chosen | Both now read from the account row; dropped from the request schema entirely. The modal's Name/Email inputs are read-only, since an editable field the server ignores is a lie. `tests/atr-submit-identity.test.ts` |
| 10 | **`assertCanPost` missing on mutating handlers** | Present on blog GET but not PATCH/DELETE; absent from `shuls/[id]` PUT, both davening child routes, both document child routes, three business handlers. A blocked account's JWT still works, so a banned user can keep editing live content | Added to blog PATCH + DELETE, `shuls/[id]` PUT, davening `[scheduleId]` PUT + DELETE, documents `[docId]` PATCH + DELETE, shoutout `[shoutoutId]` PATCH, `video/uploaded` POST, and **both upload routes** (a blocked account could push 30 MB into Blob on demand). Deliberately NOT added to `user/notification-preferences` (a blocked user must still be able to stop email), `newsletter/unsubscribe`, the auth routes or the anonymous counters |
| 11 | **Admin `users/[id]` PATCH has no schema** | `role` is an unvalidated string (fails closed, so integrity not escalation). No self-demotion guard and no last-admin guard — and there is exactly **1 active admin** | Full Zod schema (role and `commentPermission` as enums, everything else boolean). Last-admin guard extracted to `src/lib/permissions/last-admin.ts` — framed as an **outcome**, not "is this me", because demoting a *different* last admin locks everyone out identically. `tests/unit/last-admin.test.ts` + `tests/admin-user-patch-guards.test.ts` |
| 12 | **`logAudit()` has zero callers** | The `audit_log` table, its admin page and the helper all exist and record nothing. Item 0's escalation window is unreconstructible because of this | **Partly fixed.** First call site is admin `users/[id]` PATCH, with a before/after diff — every grant, demotion and block passes through there, which is exactly what item 0 needed. **Still not audited: approve/reject.** `setApprovalStatus` is the single writer for all eight types and would cover them in one call, but it takes no actor — threading a session through its ~15 call sites is a separate change |

## Low

`commentModeration` self-settable on blog create · non-profit `documentUrl`
unvalidated · shoutout edit skips the create-path scheduling rules ·
`imageUrl`/`photoUrl`/`coverImageUrl` accept arbitrary hosts · contact form
unauthenticated and unrated · `broadcast_at` unstamped on zero-recipient kosher
alerts (latent re-broadcast) · unbounded `?limit` on `/api/blog` ·
`events/conflicts` allows bulk organiser-email harvesting · `senderName`
spoofing on classified contact · forgeable open/click analytics ·
forgot-password status oracle · Mux and PayPal signature comparisons are not
constant-time · PayPal verification is conditional on
`PAYPAL_WEBHOOK_ID && NODE_ENV === "production"` — holds in production, but
fails open by shape.

---

## Checked and clean

Worth recording so the coverage is auditable rather than assumed.

- **All 185 exported handlers across 102 `/api/admin/**` files** call `auth()`
  and check the role before any database access. No unguarded handler, no
  authentication-without-authorization, no data returned before the check.
- **NextAuth callbacks** — `signIn` enforces the ban, `jwt` is now DB-sourced,
  `session` only copies the token, `authorized` is sound. No `redirect` callback,
  so the same-origin default applies.
- **No server actions exist** anywhere — there is no unprotected action surface.
- **Registration cannot escalate** — no privileged field in the schema; role,
  active and trusted are hardcoded.
- **Token flows** — reset, verify and resend use 32-byte random, expiring,
  single-use tokens with the target derived from the token row. A password reset
  deliberately does not clear `isActive`, so a banned user cannot self-unban.
- **Unsubscribe tokens** — 64-hex random, every write scoped to the resolved
  subscriber's own id.
- **No mass assignment** — no `.set({...body})`, no Zod `.passthrough()`. The
  admin/public schema split is real (`specialSchema` vs `adminSpecialSchema`,
  `createAdSchema` vs `moderateAdSchema`, `businessSchema.isFeatured` admin-only).
- **No header, cookie or query-param authorization** anywhere.
- **Ownership verified against the database** in Pusher auth, both upload routes,
  Mux create-upload, and the PayPal create/cancel/status routes.
- **Child routes are parent-scoped** — davening and documents both use
  `and(eq(id), eq(shulId))`.
- **The submissions library** is DB-sourced throughout with an atomic broadcast
  claim; no client-reachable path re-triggers a mass email.

---

## What is left

- **The whole Low list**, unchanged.
- **Approve/reject auditing** — see item 12.
- **Item 2's deeper half.** A paid plan can no longer reach the review queue
  unpaid, but the downstream gates still read the joined `subscription_plans`
  row rather than an active `businessSubscriptions` row. Only
  `businesses/[id]/shoutouts/route.ts` checks the subscription. So a plan that
  goes unpaid after activation keeps its capabilities until something changes
  the plan id.

## A shape worth naming

Three of the fixed findings, plus yesterday's three, were the same defect: **a
control enforced when a row is created and skipped when it is edited.** Shiva
`attachmentUrl`, the blog slug, shul document `fileUrl`, `assertCanPost` on
eight edit handlers.

The create route usually carries a comment explaining exactly why the control
matters. The edit route, written later, does not. Worth checking for
deliberately when adding any new validated field: **the create and edit schemas
for one column have to agree.**

---

## Suggested order, if and when you want them fixed

1. **Item 1** — anonymous, live, and the fix also un-breaks two crons that have
   never run. An env var plus normalising four guards.
2. **Items 3 and 2** — one-line ownership and price checks.
3. **Item 4** — move the slug write after the ownership check.
4. Then the medium list, of which **8** (the `iframe` URL) and **10** (blocked
   users still editing) are the ones I would not leave long.

**Item 12 is worth doing early regardless of order** — until `logAudit()` has
callers, nothing here leaves a trace, and any future incident is unreconstructible.
