# Open threads — as at 2026-08-03 (updated after the Ask the Rabbi merge)

Everything outstanding, in one place. Split into **decide** (needs Daniel) and
**do** (decided, not built). Nothing here is in progress.

Status of the code itself is in `WHERE-WE-ARE.md`; the reasoning behind
settled choices is in `decisions/`.

---

## 1. Rejecting a correction destroys the approved version — VERIFIED DEFECT

**The most important item here.** Found by discussion on 2026-08-02, then
verified in code.

An approved event is on the calendar. The submitter fixes a typo:

1. `applyEdit` writes the NEW text to the row immediately
   (`apply-edit.ts:135`), then sets the status to `pending_edit`
2. The item is now off the site — `(public)/community/calendar/[id]/page.tsx:54`
   requires `approvalStatus = "approved"`
3. The admin looks at the change and **rejects** it
4. Status becomes `rejected`

Result: **the submitter's originally-approved event is gone from the site**,
and the row now holds their unapproved text. The version that had been approved
no longer exists anywhere. Approving later would approve their new wording, not
the original.

The admin meant "don't make that change". What happened was "your event is
cancelled".

**Why it cannot simply be fixed:** there is no stored previous version to
revert to — the edit overwrites the row in place.

**Options to discuss:**

- Keep pending changes separate from the live row, so rejecting reverts
  cleanly. Correct, and the same model the business-claim design already chose
  for exactly this reason. Largest change.
- Leave the item off the site, but tell the submitter plainly what happened and
  that their previous version is not recoverable. Cheap, honest, still bad.
- Do not allow a correction to be rejected at all — the admin edits it into
  shape instead, or asks the submitter to. Avoids the data problem entirely by
  removing the action.

---

## 2. Security findings — 2026-08-04

Full write-up with evidence and exploits: `SECURITY-FINDINGS-2026-08-04.md`.
**Nothing fixed except the first item.**

- **Client-supplied role became an admin token** — FIXED and deployed (`ad81bdb`).
  Verified by exploit: a plain member POSTing `{"role":"admin"}` to
  `/api/auth/session` got `/admin` and the admin API.
- **All four cron endpoints are unauthenticated** — anonymous, live.
  `CRON_SECRET` does not exist, in `.env` or in Vercel. Two guards fail open, two
  require the literal string `Bearer undefined`. Same cause means
  `cleanup-notifications` and `notification-digest` have been 401ing Vercel's own
  scheduler — **the daily digest has never run.**
- **Any member can self-assign the $120/mo Elite plan** — `subscriptionPlanId`
  is client-supplied and no price or subscription is checked.
- **Specials can be posted under any business's name** — no ownership check.
- **A blog edit rewrites another user's slug before the ownership check** —
  permanently 404s any of 3,058 posts.
- Plus 8 medium and ~12 low, and a list of what was checked and found clean.

## 2b. Decide

| Item | Question |
|---|---|
| `halachafortoday@yahoo.com` | 1,011 published posts, same position as Rochel. Grant `canAutoApproveBlog` too, or not? |
| Daily digest | It counts corrections but shows them as plain "Events: 3". A live item sitting off the site is more urgent than a new submission — distinguish them? |
| Admin edits someone's item | The submitter is never told. They just see different text under their name. Notify, or leave it? |
| The edit-form approach | Six edit pages built from one described form rather than mirroring the existing modals. **Nobody has seen them rendered.** Recorded as provisional. |
| Five `[TEST]` shuls live on the public site | ids 2–5 are `[TEST]`-prefixed, plus `makra.ca`; all `isActive: true`, all showing at `/shuls`. Two duplicate real entries (Shaarei Shomayim, Beth Jacob V'Anshei Drildz). Delete, deactivate, or leave? |
| `canAutoApproveShiurim` / `canPostSpecials` mislabelled | Both sit under "submit without approval" but are **403 gates on submitting at all** — and since `shiurim.approvalStatus` defaults to `approved`, holding one means publish-instantly. `daniel@makra.ca` holds `canAutoApproveShiurim`. Three different meanings share one dialog heading. |
| `isTrusted` | Set on 22 users who own zero businesses between them. Leftover from the pre-per-type permission system; unexamined. |
| Push to production | 3 commits unpushed (the two toggles/notifications commits + decision records). Earlier work is live. Was 17 commits ahead of `origin/main` and **nothing is deployed**. Includes the user-submissions work, the timezone fix, and the Ask the Rabbi consolidation. Pushing makes the `$onUpdate` change to 17 `updated_at` columns user-visible. |

## 3. Do — decided, not built

| Item | Note |
|---|---|
| ~~Ask the Rabbi consolidation~~ | **Done + deployed 2026-08-03** (`4e2d17f`, pushed). Four shared screens in both shells; five bugs fixed; nine bylines and one test post repaired in production. |
| ~~Three dead permission toggles~~ | **Done 2026-08-03** (`268b1f1`), not yet pushed. Each wired to the one real approval step in its area — businesses to creation, Ask the Rabbi to comment moderation, shuls to granting a management request outright. |
| ~~Ask the Rabbi notifications~~ | **Done 2026-08-03** (`f71ceb7`), not yet pushed. Recipients are admins ∪ capability holders, deduped; each audience gets a link it can open; holders are emailed too. |
| "Your change is live" | An approval after a correction still says "Your event is live", identical to a first approval. Agreed to fix. **Worth doing together with item 1** — the same messages are involved. |
| Grant Rochel `canAutoApproveBlog` | The control now exists in Admin → Users → shield icon. Daniel's to flip; no production writes by the assistant. |

## 4. Parked deliberately

- **Business claim flow** — ~60% designed. `TODO-business-claim-flow.md`.
- **Shul managers delegating to other accounts** — agreed needed 2026-08-03,
  not designed. Today only an admin can grant shul management, so every
  staffing change at every shul routes through Daniel. Blocked on nothing
  except sequencing: **no real shul has a manager yet** (1 assignment, on a
  test shul, by a test account; 0 registration requests ever), so there is
  nobody to delegate from. `TODO-shul-manager-delegation.md`.
- **Per-shul notifications** — no way to follow a shul; a single global
  `community_events` opt-in with 49 subscribers.
  `decisions/2026-07-31-parked-per-shul-notifications.md`.
