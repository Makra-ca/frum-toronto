# Shuls — Implementation Plan (revision 2)

**Spec:** [2026-08-07-shul-affiliation-design.md](../specs/2026-08-07-shul-affiliation-design.md)
**Date:** 2026-08-07
**Status:** Not started

> **Revision 2** reflects four rounds of adversarial review and Daniel's sequencing decision:
> **fix what is broken → import the directory → add the member field.** Revision 1 assumed the
> member field was how the directory gets built. It isn't — the legacy directory supplies it
> directly — so the member field moves last and shrinks.
>
> Also reflects Daniel's correction on consent: restoring a field members gave this same site is
> continuity, not a new collection. See
> [`restoring-a-field-is-not-new-collection`](../../project-memory/decisions/2026-08-07-restoring-a-field-is-not-new-collection.md).
> `/privacy` is worth writing; it is **not** a gate on this work.

---

## Why this order

1. **Phase A is broken in production today.** It is not setup for the rest — it is a live bug fix
   that happens to be in the way.
2. **The directory must exist before the member field**, or members match against 9 shuls instead
   of ~126 and everyone types instead of picking. Auto-match goes from ~5% to 64%.
3. **The publish toggle must exist before any bulk import**, or 126 rows are permanently live or
   permanently invisible with no middle.

Each chunk ends green: `tsc` 0 errors, no new eslint errors, full suite passing. Commit per chunk.
**Every test is confirmed to fail against the unfixed code before it counts** — reintroduce the
defect, watch it go red, restore, say so in the commit.

---

# PHASE A — Fix what is broken (independent of everything else)

### A1 — `/dashboard/shuls/request` submits the wrong shul

`src/app/(dashboard)/dashboard/shuls/request/page.tsx:48` fetches **`/api/davening`**, which returns
davening-*schedule* rows. It then reads `s.businessName` and `s.address`, **neither of which exists
on that response** — so every option renders as `Shul #{id}` with no address, and the id submitted
is the schedule's, not the shul's. Live: choosing "Shul #3" requests management of
`[TEST] Chabad of Midtown`.

This is the only self-service route to shul management, and it is wrong today.

- Point it at `/api/shuls`; use `name`; render the address.
- `page.tsx:182` renders `<SelectItem value="">` when the list is empty — Radix throws on an empty
  value (the documented gotcha in CLAUDE.md). Render a disabled message instead.
- *Test:* the option list matches active shuls, and the submitted `shulId` is the shul's own id.

### A2 — Merge the duplicate `[TEST]` shuls

Already recorded in `OPEN-THREADS.md` §2b days ago, and revision 1 of this plan got it wrong by
proposing a rename.

```
id 2  [TEST] Beth Jacob V'Anshei Drildz     ←→  id 9  Beth Jacob V'Anshei Drildz Congregation
id 4  [TEST] Shaarei Shomayim Congregation  ←→  id 7  Shaarei Shomayim
id 3  [TEST] Chabad of Midtown              — no real counterpart
id 5  [TEST] Sephardic Kehila Centre        — no real counterpart (and NOT in the legacy Minyan set)
id 1  makra.ca                              — holds 3 davening_schedules + the only user_shuls row
```

**Merge, do not rename.** Renaming creates two Shaarei Shomayim rows, and the affiliation import
would then mark those members `ambiguous` and leave them unlinked — lowering the match rate this
whole sequence exists to protect.

- Audit script first (read-only): referencing rows in `events`, `shiurim`, `davening_schedules`,
  `shul_documents`, `user_shuls`, **and `shul_registration_requests`** (revision 1 omitted the last).
- Reassign children from the junk row to the surviving real row, then delete the junk row.
- ids 3 and 5 have no counterpart: deactivate (once A3 exists) pending Daniel's call.
- `makra.ca`: deactivate; its `user_shuls` row is the only one in the database — **do not delete it
  without telling Daniel whose access it is.**
- **Daniel decides** the id 3 / id 5 disposition and the `user_shuls` row before this runs.
- *Test:* no active shul name matches `^\[TEST\]`; **and** no active shul slug starts with `test-`.

### A3 — A publish/unpublish control for shuls

`isActive` is **not writable from anywhere**: absent from `shulSchema` and `ShulForm`, hardcoded
`true` in `POST /api/admin/shuls:84`, and absent from both PUT routes. Nothing can create or make an
inactive shul.

- Add `isActive` to `shulSchema`, `ShulForm`, and both admin write paths; show the state in
  `ShulTable`.
- *Test:* an admin can deactivate and reactivate; a deactivated shul disappears from `/shuls`.

### A4 — `/davening/[shulId]` ignores `isActive`

`src/app/(public)/davening/[shulId]/page.tsx:29` looks a shul up by id with **no** active check, and
renders name, address, phone, email, rabbi and nusach. Ids are sequential, so `/davening/15`…`/180`
would be live public pages the moment the directory import commits — including the office towers the
review pass exists to catch.

- Add the `isActive` filter; `notFound()` when inactive.
- *Test:* an inactive shul 404s there, mirroring `/shuls/[slug]`.

### A5 — `generateSlug` puts the trim in the wrong place

`src/app/api/admin/shuls/route.ts:9-16` (duplicated at `[id]/route.ts:9-16`) calls `.trim()` **after**
converting spaces to hyphens, so a leading or trailing space becomes a hyphen it can never remove.
Already in production: `kollel-yad-yosef-`, `kehillat-shaarei-torah-`, `bnai-torah-congregation-`.

- Trim first; guard against an empty result; de-duplicate the two copies into one helper.
- Collision handling currently appends `Date.now()`, minting a permanent public URL like
  `/shuls/bnai-torah-1754…`. Use a counter, as `getUniqueSlug` does elsewhere.
- **Do not** retro-fix existing slugs — they are live URLs. Note it for Daniel separately.
- *Test:* trailing space, leading space, all-punctuation, non-ASCII, and a collision.

---

# PHASE B — The shul directory

### B1 — Normalisation helper

`src/lib/shul-names.ts` — `normalizeShulName`: decode HTML entities (including the cp1252 numeric
range), lowercase, **remove punctuation entirely**, collapse whitespace. Returns `""` for unusable
input; callers discard rather than store.

**The cp1252 table lives in `scripts/legacy-import/lib.ts`, which imports `mssql` and `dotenv` at
module scope** — it cannot be pulled into a client bundle. Extract the table into this DB-free
module and repoint `lib.ts` at it. Dependency direction is `scripts → src`.

- *Tests:* `Aish HaTorah &#45; Thornhill` → `aish hatorah thornhill`; `B'nai Torah` → `bnai torah`
  (space-substitution gives `b nai torah` and breaks the match — 90 rows turn on this); `.` and
  `&#47;` → `""`; `Shaarei Shomayim` and `Shaarei Tefillah` do **not** collapse.

### B2 — Directory import, with a review page

`scripts/legacy-import/shul-directory.ts`, dry-run by default.

Source: `DirectoryListings WHERE Minyan = 1` — **166 rows, 165 active**, `Company` unclipped.

**Field map — every column carries its measured populated-count, because three specs this session
asserted data on the strength of a column existing:**

| Legacy | → | Populated |
|---|---|---|
| `Company` | `name` | 166/166 |
| `Address` | `address` | 164/166 |
| `City` | `city` | 161/166 |
| `PostalCode` | `postalCode` | 127/166 |
| `PhoneNumber` | `phone` | 133/166 |
| `Email` | `email` | 70/166 |
| `WebUrl` | `website` | 50/166 |
| **`LocationID` → `Locations.Location`** | **`neighborhood`** | **164/166** |
| ~~`Latitude`/`Longitude`~~ | — | **0 usable — all zero. Do not map.** |
| ~~`Comments`~~ | — | 166/166 but it is an audit dump, not prose. Do not map to `description` |

There is **no** rabbi, nusach or denomination column in the legacy data. Those stay null.

**Review gate.** A localhost page lists all 166 with name, address and neighbourhood, each with a
keep/drop toggle and a save. ~35 are plainly not shuls (Yogen Fruz, York University, three law
firms, Mount Sinai Hospital), ~5 are duplicate rows of one shul. Expect **~126 keeps**.
`--commit` refuses to run without a saved decision file.

**Dedup against existing shuls.** All nine real Postgres shuls collide with a legacy row. Match on
normalised name and **update** rather than insert; only unmatched candidates are created.

`shuls` has **no `old_id` column** — add it in B2, not in a later chunk (revision 1 depended on it
one chunk early), with a partial unique index.

Created shuls start `isActive = false`. Requires A3.

- *Tests:* re-run inserts 0; the nine existing shuls are updated not duplicated; a dropped candidate
  never appears; neighbourhood is populated on ~164.

### B3 — Neighbourhood vocabulary

`shul_neighborhoods` holds 8 hand-seeded names (Thornhill, Forest Hill, North York…). The legacy
vocabulary is 20 intersection-based names the community actually uses — *Bathurst & Wilson* (27),
*Bathurst & Lawrence* (24), *Bathurst & Clark* (21), *Down Town* (18).

**Daniel decides:** adopt the legacy vocabulary, keep the current one and map onto it, or run both.
Nothing in B2 writes `neighborhood` until this is settled.

### B4 — Davening times — assess, do not assume

734 rows / 122 shuls, 0 orphans. **A third cannot be stored in the current schema:** 240 rows are
zman-relative (`Shkia -20`, `Plag`, `Neitz`), 116 have no time at all, and `davening_schedules.time`
is `time NOT NULL` with no anchor or offset column. 7 weekday booleans fan out against one
`dayOfWeek`.

Deliverable for this chunk is a **written assessment plus a schema proposal**, not an import. A
partial import is worse than none — a shul page showing Shacharis and silently omitting Mincha
because Mincha is shkia-relative.

Note this interacts with B2: "unpublished until it has a davening time" would strand the 37 shuls
whose schedules are entirely zman-relative.

---

# PHASE C — The member field

Now cheap, because the directory exists. Full detail in the spec; the corrections that matter:

### C1 — Schema

Four columns on `users` (`shul_id`, `shul_name_text`, `shul_status`, `shul_answered_at`) plus
`shul_name_aliases`.

- **Trigger BEFORE constraints.** `apply-sql-file.ts` runs statements in a bare loop with **no
  transaction**; a failure between the CHECKs and the trigger leaves production unable to delete any
  shul. Revision 1 had this backwards.
- `CREATE OR REPLACE TRIGGER` and `DROP CONSTRAINT IF EXISTS` — the file is applied twice (primary
  and test branch) and neither statement is idempotent by default.
- `shulStatus` **must** be `.notNull().default("unset")` in Drizzle, not only in SQL, or
  `DrizzleAdapter.createUser` — which inserts four fields — makes **every Google sign-up 500**.
- `private` must be allowed to **retain** the answer. Revision 1's invariants forced it to NULL,
  making "prefer not to say" destructive and irreversible.
- `btrim(x, E' \t\r\n')`, not bare `btrim` — that strips spaces only.
- Add an index on `users.shul_id`.
- *Test first:* deleting a shul with a linked member **succeeds** and the member degrades. Watch it
  fail without the trigger.

### C2 — Affiliation import

Join on `old_member_id`, **then email fallback** — 2,121 reachable directly, 202 not, of which 193
recover by email, 9 are unreachable and must be **named in the output**, not silently skipped.

Dedup for 141 duplicate emails / 39 conflicting affiliations: newest `CreatedDate`, then higher
`MemberID` (`members.ts:145-150`).

**Pin the prefix rule: normalised length ≥ 8.** Undocumented in revision 1, and it is load-bearing —
without it `na` (15 members) prefix-matches *Nachal Yisroel* and `jc` matches *JCLL*. It costs 4
correct matches (`bobov` → Bobover Shteibel) to remove 16 junk ones.

Everything lands as `imported`, never `listed`/`typed`. Output is **aggregate-only** — no row-level
person→shul pairs to a terminal.

Expected: ~122 values / ~1,498 members auto-resolved (64%), 12 ambiguous, ~434 unmatched. Measured
against all 166; **the review gate drops ~35, so re-measure after B2 rather than treating this as a
pass/fail gate.**

### C3 — Member-facing

- `ShulAffiliationField`: with ~126 shuls this **is** a typeahead, not a plain list. Revision 1
  argued for a list against 9 rows and then scheduled an import that obsoletes that argument two
  chunks earlier.
- Register form: required, with one line of copy — *"This helps us build the shul directory. Only
  you and site admins can see it."*
- `PATCH /api/user/profile` — new route. Target user from `session.user.id`, **never** the body.
- A **Profile** card in the dashboard, separate from the notifications card. Note there is already
  a read-only "Your Profile" card at `dashboard/page.tsx:161` — decide whether to extend it or add
  beside it.
- "Remove my shul".
- *Test:* a valid registration succeeds in each state; **the Google path still works**;
  `verifyTurnstileToken` fails open outside production so no mocking is needed.

### C4 — The dashboard card

Shown when `shul_status` is `unset` or `imported`. Catches Google sign-ups (who never submit
`registerSchema`), the imported cohort, and refreshes 2010 answers with *"you told us this in 2010 —
still right?"*

**Dismissal needs somewhere to live** — a column, decided in C1, not bolted on after the migration
has been applied to both databases.

### C5 — Admin queue

Unresolved aliases, defaulting to ≥3 members (~45 rows), tail behind a toggle. Create / link /
dismiss / ambiguous. **"Create shul" shows the member's typed string as a quote and the admin types
the real name** — `shuls.name` is public and feeds the slug. Back-linking calls `logAudit`.

---

## Open — needs Daniel

| | |
|---|---|
| **A2** | ids 3 and 5 (no real counterpart) — deactivate or delete? And the single `user_shuls` row on `makra.ca` — whose access is it? |
| **B2** | the keep/drop review of 166 candidates |
| **B3** | neighbourhood vocabulary — legacy intersections, the current 8, or both |
| **B4** | whether to change `davening_schedules` to hold zman-relative times |
| **A5** | whether to retro-fix the three live trailing-hyphen slugs (changes public URLs) |

## Deliberately deferred

Multiple shuls per member · shul managers seeing membership · public counts · newsletter
segmentation by shul · geocoding from `PostalCodes` (parked in `docs/planning/future-ideas.md`) ·
the other unimported legacy data (`OPEN-THREADS.md` §5).
