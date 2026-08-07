# Shul Affiliation — Implementation Plan

**Spec:** [2026-08-07-shul-affiliation-design.md](../specs/2026-08-07-shul-affiliation-design.md) (revision 2)
**Date:** 2026-08-07
**Status:** Not started

## Ordering rationale

The sequence is not arbitrary. Three dependencies force it:

1. **Junk-shul cleanup precedes the directory import**, or `[TEST] Shaarei Shomayim Congregation`
   fails to normalise while the queue simultaneously suggests creating Shaarei Shomayim.
2. **The directory import precedes the affiliation import**, or the 64% auto-match rate collapses to
   the 5% revision 1 measured against 9 shuls.
3. **`/privacy` precedes anything member-facing**, because the field cannot be collected under a
   policy that does not describe it.

Each chunk ends green: `tsc` 0 errors, eslint no new errors, full suite passing. Commit per chunk.

**Every test must be confirmed to fail against the unfixed code before it counts.** The ads review
found tests that passed against three separately injected bugs. Reintroduce the defect, watch it go
red, restore, note it in the commit.

---

## Chunk 0 — Prerequisites and traps (no feature code)

Independent of the feature; each is a trap it would otherwise spring.

- **0.1** `/api/shuls/route.ts:28` — replace `db.select()` with an explicit column list.
  *Test:* response body keys are exactly the intended set; a new column on `shuls` does not appear.
- **0.2** `admin/audit-log/page.tsx:117` — prefix any CSV cell matching `/^[=+\-@\t\r]/` with `'`.
  *Test:* a cell of `=HYPERLINK("http://x","y")` is neutralised.
- **0.3** Record the registration baseline: weekly `count(users) group by week` for the 8 weeks
  before launch. Write the numbers into spec §9. Not code — a measurement that must exist before
  a required field ships.
- **0.4** `/privacy` route carrying the existing text **plus** a shul-affiliation purpose and a
  contact for access/correction. Link from the footer (replacing the URL-less dialog) and from the
  register form. **Get Daniel's sign-off on the wording before merging.**

---

## Chunk 1 — Normalisation

- **1.1** `src/lib/shul-names.ts` — `normalizeShulName`. Entity decoding (including the cp1252
  numeric range, reusing `htmlToText`'s table from `scripts/legacy-import/lib.ts`), lowercase,
  punctuation removed **entirely**, whitespace collapsed. Returns `""` for unusable input; callers
  must discard rather than store.
- **1.2** Tests — pinned against real legacy values:
  - `Aish HaTorah &#45; Thornhill` → `aish hatorah thornhill`
  - `B'nai Torah` → `bnai torah` (**the pinned punctuation rule**; space-substitution gives
    `b nai torah` and breaks the match — 90 rows / 54 values turn on this)
  - `.` and `&#47;` → `""`
  - `Shaarei Shomayim` and `Shaarei Tefillah` do **not** collapse
  - `shoavei mayim` / `Shoavei Mayim` do collapse

No database work in this chunk. It is pure, so it is cheap to get exactly right first.

---

## Chunk 2 — Junk shul cleanup

**Must run before Chunk 3.** All five rows have `events` with `NO ACTION` FKs, so `DELETE` fails —
verified. Do not attempt it.

- **2.1** Audit script: for each of ids 1–5, list referencing rows in `events`, `shiurim`,
  `davening_schedules`, `shul_documents`, `user_shuls`. Read-only; output reviewed by Daniel.
- **2.2** Rename ids 2–5 to their real names (`Shaarei Shomayim Congregation`,
  `Sephardic Kehila Centre`, `Beth Jacob V'Anshei Drildz`, and whichever the fourth resolves to),
  treating them as thin real entries. Deactivate `makra.ca` (id 1) and reassign or delete its 3
  `davening_schedules` and 1 `user_shuls` row.
- **2.3** Verify: no active shul name matches `^\[TEST\]` or `makra`. Public `/shuls` shows only
  real shuls.

**Daniel decides 2.2 before it runs** — renaming a row that has events attached changes what those
events say they belong to.

---

## Chunk 3 — Legacy shul directory import

- **3.1** `scripts/legacy-import/shul-directory.ts`, dry-run by default. Reads the 166
  `Minyan=1` listings; maps `Company`, `Address`, `City`, `PostalCode`, `PhoneNumber`, `Email`,
  `WebUrl`, `Latitude`, `Longitude`.
- **3.2** **Review gate.** Writes `docs/legacy-shul-candidates.md` — every candidate with its
  address, flagged where the name looks like an address rather than a shul (`120 Bremner
  Boulevard | 8th Floor`, `175 Bloor Street East`). `--commit` **refuses to run** unless a reviewed
  file with explicit keep/drop marks is supplied. Daniel reviews.
- **3.3** Commit path: insert kept candidates as shuls, `isActive = false` (unpublished) until they
  have an address and at least one davening time. `old_id` recorded so a re-run is idempotent, with
  a partial unique index as the legacy import already does elsewhere.
- **3.4** Davening schedules: 734 rows / 122 listings. Import where the shape maps onto
  `daveningSchedules`; **report and skip** where it does not. Do not guess a schedule.
- **3.5** Verify: shul count, how many have an address, how many have a schedule; re-run inserts 0.

---

## Chunk 4 — Schema

- **4.1** Migration: four columns on `users` (§2.1), the six-value `shul_status`, and
  `shul_name_aliases` (§2.3) with its four-value status.
- **4.2** CHECK constraints per the §2.1 invariant table, including `btrim(...) <> ''` on the text
  columns. **Declared with drizzle `check()` in `schema.ts`, not only in the migration** — `db:push`
  silently drops SQL-only constraints, proven in the ads work.
- **4.3** `BEFORE DELETE` trigger on `shuls`: rewrite affected members to `typed`/`imported`,
  preserving `shul_name_text`, before the cascade nulls `shul_id`.
- **4.4** Apply to **primary and the Neon test branch**. A migration applied to one is how every
  plan-capability test failed with `column does not exist`.
- **4.5** Tests — and 4.5.3 is the one that matters:
  - all six statuses accepted; `imported` + `shul_id` accepted; blank text rejected
  - `listed` with NULL `shul_id` rejected
  - **deleting a shul with a linked member SUCCEEDS**, the member becomes `typed`/`imported`, and
    `shul_name_text` survives. *Write this test first and watch it fail without the trigger* — the
    trigger-less design does not merely mis-handle this, it makes deletion impossible.

---

## Chunk 5 — Member affiliation import

- **5.1** `scripts/legacy-import/shul-affiliations.ts`, dry-run by default.
- **5.2** Member→user join: `old_member_id` first, **email fallback second** (recovers 193 of the
  202 unreachable). The 9 with no route are **reported by name**, not silently skipped.
- **5.3** Dedup for the 141 duplicate emails / 39 conflicting affiliations: newest `CreatedDate`,
  then higher `MemberID`, matching `members.ts:139-152`. Without this the first run is
  non-deterministic.
- **5.4** Resolution: existing alias → exact single candidate → unique prefix → unmatched.
  More than one candidate ⇒ `ambiguous` alias, member left unlinked. A `dismissed` alias resolves
  to **unmatched**, never to a link.
- **5.5** Everything written as `imported`, `shul_answered_at` NULL. Never `listed` or `typed`.
- **5.6** Alias inserts `ON CONFLICT DO NOTHING` so a re-run cannot reset an admin decision.
- **5.7** Output **aggregate-only** — counts per outcome, top unmatched normalised names with
  counts. **No row-level person→shul output** without an explicit `--show-rows` flag.
- **5.8** Tests: idempotent re-run writes 0; alias decisions survive; dedup deterministic;
  `dismissed` → unmatched; empty normalisation creates nothing.
- **5.9** Verify against the measured expectation: ~122 values / ~1,498 members auto-resolved (64%),
  12 ambiguous, ~434 unmatched. **A materially different result means the directory import or the
  normaliser is wrong** — do not proceed past a mismatch.

---

## Chunk 6 — Member-facing UI

- **6.1** `ShulAffiliationField` — a plain list of the four choices, **not** a typeahead (§4.4).
  Shared by the register form and the dashboard.
- **6.2** Register form: required, with the "why we ask" line and the `/privacy` link.
  Server-side validation of the legal `(status, shul_id, text)` combinations; `shul_id` must exist
  and be active.
- **6.3** `PATCH /api/user/profile` — new route. Target user comes from `session.user.id`,
  **never** the request body (this codebase has already shipped one privilege escalation from
  trusting a client payload). Accepts only the affiliation fields. Enforce length and reject control
  characters — `varchar(150)` is storage, not validation.
- **6.4** Dashboard **Profile** card, separate from the notifications card, with its own save and
  dirty state. `/dashboard/settings` is notifications-only and its Select All button rewrites the
  whole object.
- **6.5** "Remove my shul" → `none`/`private`.
- **6.6** Tests: a valid registration succeeds in each legal state; **the Google path still works**;
  the PATCH rejects a body-supplied user id; blank/control-character text rejected.

---

## Chunk 7 — The dashboard card

- **7.1** Card at the top of `/dashboard` when `shul_status` is `unset` or `imported`. Dismissible;
  dismissal remembered; stops after N appearances.
- **7.2** `imported` copy: *"You told FrumToronto in 2010 that you daven at X. Still right?"* —
  Yes / Change / Remove. Yes stamps `shul_answered_at` and moves off `imported`.
- **7.3** `unset` copy: the plain question.
- **7.4** Tests: shown for `unset` and `imported`, hidden for `listed`/`typed`/`none`/`private`;
  confirming stamps `shul_answered_at`; dismissal persists.

---

## Chunk 8 — Admin queue

- **8.1** Tab under Shuls. Unresolved aliases, **defaulting to ≥3 members** (45 rows), long tail
  behind a toggle.
- **8.2** Actions: Create shul · Link to existing · Not a shul · Ambiguous.
- **8.3** Create shul shows *"A member typed: `<value>`"* and the admin types the directory name.
  **No silent pre-fill** — `shuls.name` is public and feeds the slug.
- **8.4** Created shuls start unpublished until they have an address and a davening time.
- **8.5** Back-linking applies exact and unique-prefix matches; **never ambiguous**. Calls
  `logAudit` — it writes `shul_id` across hundreds of rows in one click.
- **8.6** No export. On-page notice: *"Member affiliation is private. Do not circulate."*
- **8.7** Tests: ambiguous never auto-applies; audit row written; back-link preserves
  `shul_name_text`; a linked member can be un-linked.

---

## Chunk 9 — Privacy hardening

- **9.1** Add `shul_name_aliases` to `deleteUserWithContent`'s table lists; drop `raw_example` when
  an alias resolves.
- **9.2** Test: after `deleteUserWithContent`, **no table retains a string that user supplied**.
  Write it generically so it catches the next table too.
- **9.3** Sentinel test: a fixture member with a unique `shul_name_text`; assert it appears in no
  response from `/api/shuls`, `/api/shuls/slug/[slug]`, `/api/blog`, `/api/blog/[slug]/comments`,
  `/api/search/suggestions?type=all`.
- **9.4** Amend the `shul-affiliation-is-private` decision record: "admins" is **one shared
  credential**, `admin@frumtoronto.com`, and access is not individually attributable.

---

## Verification before merge

- `tsc` 0 errors; eslint no new errors; full suite green.
- Both migrations applied to primary **and** the test branch.
- The affiliation import re-run inserts 0.
- Live check with the dev server pointed at the **test** branch: register a new member in each of
  the four states; sign in with Google and confirm the card appears; confirm an `imported` member's
  card and check `shul_answered_at` is stamped.
- Public `/shuls` shows no `[TEST]` or `makra.ca` row.

## Deliberately deferred

Multiple shuls per member · shul managers seeing membership · public counts · newsletter
segmentation by shul · a typeahead picker (revisit above ~40 shuls) · importing member addresses.

## Open, needs Daniel

- **2.2** — renaming `[TEST]` rows that already have events attached.
- **3.2** — the keep/drop review of 166 candidates.
- **0.4** — the privacy policy wording.
