# Shul Affiliation — Design

**Date:** 2026-08-07 (revision 2)
**Status:** Design, awaiting approval
**Trigger:** Daniel recalled that the legacy site asked members which shul they affiliate with, and asked whether we could check — then surface it at signup and in the dashboard.

**Decision records:**
[typed-shuls-are-suggestions-not-shuls](../../project-memory/decisions/2026-08-07-typed-shuls-are-suggestions-not-shuls.md) ·
[shul-affiliation-is-private](../../project-memory/decisions/2026-08-07-shul-affiliation-is-private.md) ·
[legacy-shul-affiliation-is-imported-not-discarded](../../project-memory/decisions/2026-08-07-legacy-shul-affiliation-is-imported-not-discarded.md) ·
[shul-affiliation-is-required-with-honest-opt-outs](../../project-memory/decisions/2026-08-07-shul-affiliation-is-required-with-honest-opt-outs.md)

> **Revision 2 exists because revision 1's central premise was false.** It claimed the blocker
> was an empty shul directory that could only be filled by hand, 574 rows at a time. In fact
> `FrumToronto.dbo.DirectoryListings WHERE Minyan = 1` holds **166 shul listings** with full
> unclipped names, addresses, phones and coordinates, in the same read-only database the
> importer already connects to — and 734 davening-schedule rows across 122 of them. Revision 1
> found and printed `DirectoryListings.Minyan` in its first exploratory query and did not follow
> it. Every figure below has been re-derived.

---

## 1. What is true

Measured against the live databases on 2026-08-07. Figures are stated with the definition used,
because "distinct" turned out to be collation-dependent and revision 1 quoted one without saying so.

### 1.1 The member field

| | |
|---|---|
| `MemberList` rows | 3,307 |
| Non-empty `ShulAffiliation` | **2,323 (70%)** |
| Distinct raw values — SQL Server default collation (case-insensitive) | 585 |
| Distinct raw values — case-sensitive | 658 |
| **Distinct after normalisation (§3)** | **568** ← the only figure that sizes work |
| Rows containing HTML entities | 92 (93 rows change under the full cleaner) |
| Exactly 25 characters long | **759 (33%)** — the old form clipped on write |
| Longest value | 52 chars, and it is `"I am moving to Toronto this week so unsure as of now"` |
| Column | `nvarchar(100)`, **0 rows at the limit** — the clipping is in the data, not the column |

### 1.2 The legacy shul directory — the thing revision 1 missed

`DirectoryListings WHERE Minyan = 1`: **166 named listings**, with `Company nvarchar(100)`
(unclipped), `Address`, `City`, `PostalCode`, `PhoneNumber`, `Email`, `WebUrl`, `Latitude`,
`Longitude`. Plus `DaveningSchedule`, 734 rows across 122 listings.

**Not all 166 are shuls.** Office addresses have been flagged `Minyan=1` — e.g.
`120 Bremner Boulevard | 8th Floor` appears three times, and `175 Bloor Street East`. A human
review pass is a required step, not an optional one (§5.1).

### 1.3 Matching members to that directory

Normalised per §3, against the 166 listings:

| | values | members | share |
|---|---|---|---|
| Exact, exactly one candidate | 66 | 778 | 33% |
| Prefix, exactly one candidate (the clipped names) | 56 | 720 | 31% |
| **Auto-resolvable** | **122** | **1,498** | **64%** |
| Ambiguous — more than one candidate | 12 | 58 | 2% |
| No match | 434 | 764 | 33% |

**The leftover queue at ≥3 members is 45 rows covering 337 members.** That is the entire manual
workload, and it is a morning's work rather than an open-ended project. The tail below 3 is
dominated by one-person entries and junk (`na`, `none`, `x`, an email address).

The top leftovers are instructive about what a human is actually for: `bayt` (48 — an acronym no
algorithm resolves), `chabad` (17 — genuinely ambiguous across several Chabad houses),
`shaarei shomayim synagogu` (18 — the directory says *Congregation*, the member typed *Synagogue*).

### 1.4 The current Postgres directory

`shuls`: **14 rows** — id 1 `makra.ca`, ids 2–5 `[TEST]`, ids 6–14 real. Note **`JEP` is id 13, a
real row.** Revision 1 used `JEP` as its canonical "not a shul" example in both the spec and a
decision record; that example was wrong and is withdrawn.

---

## 2. Data model

### 2.1 Four columns on `users`

```sql
ALTER TABLE users
  ADD COLUMN shul_id          integer REFERENCES shuls(id) ON DELETE SET NULL,
  ADD COLUMN shul_name_text   varchar(150),
  ADD COLUMN shul_status      varchar(20) NOT NULL DEFAULT 'unset',
  ADD COLUMN shul_answered_at timestamp;
```

`shul_status` ∈ `listed | typed | imported | none | private | unset`.

**`imported` is a distinct status, and this is the fix for revision 1's worst contradiction.**
Revision 1 claimed `unset` would distinguish "never asked" from "answered", then set every
imported member to `listed`/`typed` — so for all 2,323 people the claim was about, a 2010
mailing-list value became byte-identical to a self-declared one. `imported` means *we hold a value
this person gave the old site, and they have not confirmed it to us.* It renders differently (§4.3)
and is never presented as a current declaration.

`shul_answered_at` is NULL until the member confirms. Together they answer "did this person tell
*us* this, and when".

**Invariants** — declared with drizzle `check()` in `schema.ts`, not only in the migration. The ads
work proved `db:push` silently drops constraints that exist only in SQL.

| status | `shul_id` | `shul_name_text` |
|---|---|---|
| `listed` | NOT NULL | NOT NULL, non-blank |
| `typed` / `imported` | NULL or NOT NULL | NOT NULL, non-blank |
| `none` / `private` / `unset` | NULL | NULL |

Note `imported` permits a `shul_id`: an imported member auto-matched to a shul is linked **and**
unconfirmed. That combination is the whole point, and revision 1's table could not express it.

Text columns are `btrim(...) <> ''` guarded — revision 1's invariants accepted `listed` with an
empty `shul_name_text`, which destroys the undo property §6 depends on.

### 2.2 Shul deletion needs an explicit path — `ON DELETE SET NULL` alone does not work

Revision 1 said a linked member would "degrade to `typed`" on shul deletion. **Nothing implemented
that**, and worse, the CHECK made deletion *fail*: the cascade nulls `shul_id` while `shul_status`
stays `listed`, violating the constraint and aborting the whole `DELETE`. A reviewer reproduced it
on the test branch.

This is the same defect shape as the ads work (`ON DELETE SET NULL` defeated by a CHECK), which
revision 1 cited by name in its own test section and then rebuilt three paragraphs above.

**Resolution:** a `BEFORE DELETE` trigger on `shuls` that rewrites affected members to
`typed`/`imported` (preserving `shul_name_text`) before the cascade runs. Application-level
deletion is not sufficient — `shuls` rows are deletable from more than one path, and a trigger
cannot be bypassed.

### 2.3 `shul_name_aliases`

```sql
CREATE TABLE shul_name_aliases (
  id              serial PRIMARY KEY,
  normalized_name varchar(150) NOT NULL UNIQUE,
  raw_example     varchar(150) NOT NULL,
  shul_id         integer REFERENCES shuls(id) ON DELETE CASCADE,
  status          varchar(20) NOT NULL DEFAULT 'pending',
                  -- pending | linked | dismissed | ambiguous
  decided_by      integer REFERENCES users(id) ON DELETE SET NULL,
  decided_at      timestamp,
  created_at      timestamp DEFAULT NOW(),
  CHECK (status <> 'linked' OR shul_id IS NOT NULL)
);
```

`ambiguous` is a fourth status revision 1 lacked. Six normalised names in the legacy directory map
to **two genuinely different congregations** (`kehillat shaarei torah` exists in both Toronto and
Willowdale; likewise `maon noam minyan`, `magen david sephardic congregation`, `westmount shul
learning centre`, `kollel oholei yom tov`). A global `UNIQUE` on `normalized_name` cannot point at
both. `ambiguous` records that the name is unresolvable by string alone, so those members stay
`typed`/`imported` and are asked rather than guessed at.

`raw_example` is a **non-identifying exemplar** and is dropped when the alias is resolved — see
§7.3. It must not become a permanent record of one identifiable person's typed string.

---

## 3. Normalisation

One exported function, `src/lib/shul-names.ts`, used by the signup form, both importers, and the
admin queue.

```
normalizeShulName(raw):
  decode HTML entities, including the cp1252 numeric range   (reuse htmlToText's table)
  → lowercase
  → remove punctuation ENTIRELY (not replaced with a space)
  → collapse whitespace, trim
```

**The punctuation rule is pinned deliberately.** Revision 1 said "strip punctuation" without
saying to what; the two readings disagree on **90 rows / 54 distinct values**. Removing entirely
makes `B'nai Torah` → `bnai torah`, which matches a `Bnai Torah` directory row; replacing with a
space gives `b nai torah`, which does not. Pinned, and tested.

**Empty results are discarded, not stored.** Three values (`.`, `&#47;` ×2) normalise to the empty
string. They must not create an alias row or a `typed` member.

**Deliberately NOT done:** no stemming, no edit-distance, no stripping of `Congregation` /
`Synagogue` / `The`. `Shaarei Shomayim` and `Shaarei Tefillah` are different places. Merging is a
human judgement recorded in the alias table.

---

## 4. Where members are asked

### 4.1 Sign-up form — required

The shul question is required on `POST /api/auth/register`, with a picker plus **My shul isn't
listed** (text), **I don't have a shul right now**, and **Prefer not to say**.

A **"why we ask"** line is mandatory, not decorative: *"This helps us build the shul directory.
Only you and site admins can see it."* A required question about religious affiliation with no
stated reason reads as data collection for its own sake.

### 4.2 The dashboard card — because the form reaches almost nobody

`GoogleSignInButton` sits on the register form and Google sign-up **never submits
`registerSchema`** — Auth.js creates the user through the `profile()` callback and lands them on
`/dashboard`. So "required at signup" reaches new email registrations only. It does not reach
Google sign-ups, and it does not reach the **2,323 imported members**, who already have accounts.

A **dismissible card** at the top of `/dashboard`, shown to anyone whose `shul_status` is `unset`
or `imported`. Dismissal is remembered and the card stops after a few appearances.

This deliberately creates two standards — email registrants must answer, everyone else is nudged.
That is accepted: a wall in front of 2,323 existing members who came to check the eruv is worse
than an uneven completion rate.

### 4.3 The same card refreshes stale data

For an `imported` member the card reads: *"You told FrumToronto in 2010 that you daven at Clanton
Park. Still right?"* — **Yes** (→ `listed`/`typed`, stamps `shul_answered_at`), **Change**,
**Remove**.

One screen therefore closes three gaps: Google sign-ups, imported members never seeing the form,
and 16-year-old data being presented as a current declaration.

### 4.4 The picker is a list, not a search box

With 9 shuls today (≈150 after §5.1), a debounced search-with-dropdown is wrong: **94% of members
currently get zero results**, which reads as broken, and they hit it *before* discovering "My shul
isn't listed". Render the options as a plain list with the four choices as visible peers. Revisit a
typeahead above ~40 entries.

The `UserPicker`/`BusinessPicker` pattern is explicitly **not** followed here; its own docstring
says it exists because `users` grew to ~3,150 rows against a paginated endpoint. Neither applies.

### 4.5 Where it lives in the dashboard

`/dashboard/settings` is a **notifications-only** page — one card, one state object, one PATCH, and
Select All / Deselect All buttons that rewrite the whole object. Dropping a shul picker in there is
incoherent. A separate **Profile** card with its own save and dirty state is required. There is no
profile page today; this is new work and is budgeted as such.

---

## 5. Import, in two stages

### 5.1 Stage one — the shul directory (new, and it comes first)

`scripts/legacy-import/shul-directory.ts`. Reads the 166 `Minyan=1` listings and writes candidate
shuls with name, address, city, postal code, phone, website and coordinates.

**A human review pass is mandatory before commit.** The script writes a reviewable file listing
every candidate; §1.2 shows office addresses among them. `--commit` refuses to run without a
reviewed list.

Davening schedules (734 rows / 122 listings) are imported in the same stage where the shape maps
onto `daveningSchedules`; where it does not, they are reported and skipped rather than guessed.

### 5.2 Stage two — member affiliations

`scripts/legacy-import/shul-affiliations.ts`. Dry-run by default, `--commit`, `--limit=N`.

Resolution order per member: existing alias → exact single candidate → unique prefix → otherwise
unmatched. Ambiguous names (more than one candidate) create an `ambiguous` alias and leave the
member unlinked.

Everything imported is written as **`imported`**, never `listed` or `typed`, with
`shul_answered_at` NULL.

**Joining members to users.** `old_member_id` exists only on `email_subscribers`. Measured
reachability of the 2,323: **2,121 via `old_member_id`; 202 not reachable**, of which 193 are
recoverable by email, 2 have no email, 7 have no `users` row. Revision 1 said "~148" and attributed
it entirely to email opt-outs; both were wrong. The email fallback is required, and the 9
unreachable are reported explicitly, not silently dropped.

**Duplicate legacy rows need the dedup rule stated.** 141 legacy emails appear on more than one
`MemberList` row, and **39 have more than one distinct affiliation**. Without a rule the outcome
depends on iteration order. Use the member import's existing rule — newest `CreatedDate`, then
higher `MemberID` wins (`members.ts:139-152`).

**Idempotency.** Re-running writes nothing new. Alias inserts are `ON CONFLICT DO NOTHING` so a
second run cannot reset an admin's `linked`/`dismissed` decision to `pending`. A member is skipped
when `shul_status` is anything other than `unset`. A `dismissed` alias resolves to *unmatched*, not
to a link — revision 1 left that undefined, and the naive reading writes `listed` with a NULL
`shul_id`, which the CHECK rejects.

**Output is aggregate-only.** Counts per outcome, and top unmatched normalised names with counts.
**Never a row-level sample pairing a person to a shul** — the existing member importer prints email
addresses, and that output lands in scrollback, logs and assistant transcripts.

---

## 6. Admin

A tab under Shuls listing unresolved aliases, **defaulting to ≥3 members** (45 rows) with the
long tail behind a toggle. A queue that shows 434 rows forever is a queue nobody works.

Per row: **Create shul** · **Link to existing** · **Not a shul** · **Ambiguous — ask members**.

**Create shul does not silently publish member-typed text.** The row shows *"A member typed:
`<value>`"* and the admin enters the directory name themselves. `shuls.name` is rendered publicly
and feeds `generateSlug`, so one distracted click would otherwise publish a member's exact string
to a permanent public URL.

**Created shuls start unpublished** until they have an address and at least one davening time.
Otherwise the directory grows from 9 good pages to 60 empty ones and the public feature gets worse
while the admin metric improves.

**Back-linking.** Exact and unique-prefix matches apply. **Exactness of a string is not exactness
of a referent** — where a name matches more than one candidate it is `ambiguous` and is never
auto-applied. Revision 1's rule ("exact is a fact, prefix is a guess") was backwards for this data:
`chabad lubavitch communit` resolves to exactly one listing, while the exact string
`kehillat shaarei torah` names two different congregations.

Back-linking writes `shul_id` across potentially hundreds of member rows in one click and
**must call `logAudit`**. Revision 1 specified no audit record despite `logAudit` existing.

**No export.** The page carries a notice: *"Member affiliation is private. Do not circulate."* An
aggregate list is portable in a way a database is not.

---

## 7. Privacy

### 7.1 Prerequisite: a real privacy policy

The current policy is four sentences in a footer `<Dialog>` with **no URL** — it cannot be linked
from the signup form. It covers "contact information and email addresses". Religious affiliation is
neither.

**Ship `/privacy` first**, stating the purpose for shul affiliation and naming a contact for access
and correction, and link it from the register form beside the field. This is a prerequisite, not a
follow-up. (Legal framing is PIPEDA — Ontario has no private-sector statute and Quebec's Law 25
does not apply. Not legal advice; confirm with counsel.)

### 7.2 Visibility

Member and admins only. Not public, not to shul managers, no counts on shul pages.

**Stated honestly:** there is exactly **one admin account**, `admin@frumtoronto.com` — a shared role
mailbox. So "admins" means *whoever holds that credential*: not enumerable, not revocable
per-person, and every audit entry will read the same address. The `shul-affiliation-is-private`
record must be amended to say this rather than implying a set of named people.

### 7.3 Retention and deletion

`deleteUserWithContent` works from two hardcoded table lists. **`shul_name_aliases` is in neither**,
and `decided_by` is `ON DELETE SET NULL`, so deleting a user would silently leave their typed string
behind — permanently, and reidentifiable where the value is distinctive.

Required: add the table to the deletion lists, drop `raw_example` when an alias is resolved, and add
an integration test asserting no table retains a string a deleted user supplied.

Members also need self-service: **"Remove my shul"** in the dashboard, writing `none`/`private`.

### 7.4 The 148/202 opt-outs

The unreachable cohort includes legacy `RemoveMe` members, whom the July import deliberately gave
*no* `email_subscribers` row because "that is what actually guarantees silence". Reading that
absence as a join bug to route around is wrong. Of the 156 `RemoveMe` rows, **57 have an
affiliation**. They are imported as `imported` like everyone else — `RemoveMe` withdrew consent to
*contact*, not to processing — but they are never emailed about it, and the decision is recorded
rather than left as a bullet in a risks section.

---

## 8. Cleanup

The five junk `shuls` rows **cannot be deleted**. `events.shul_id` and `shiurim.shul_id` are
`NO ACTION`, and all five have events (1, 5, 5, 5, 5). Revision 1's §8 was wrong about all five.

Instead, **before the import runs**:

- `makra.ca` (id 1) — deactivate. It also holds the only `user_shuls` row in the database and 3
  `davening_schedules`.
- The four `[TEST]` rows — three are named after **real Toronto shuls**
  (`Shaarei Shomayim Congregation`, `Sephardic Kehila Centre`, `Beth Jacob V'Anshei Drildz`).
  **Rename** them to the real names and treat them as thin real entries, reassigning their events.
  Deactivating instead would leave `[TEST] Shaarei Shomayim Congregation` unmatched by
  normalisation while the queue simultaneously suggests creating Shaarei Shomayim — manufacturing
  the duplicate the alias table exists to prevent.

Sequencing matters: this runs **before** §5, so the exact-match step benefits.

---

## 9. Adjacent fixes in the same branch

Each is under thirty minutes and each is a trap this feature would spring:

- **`/api/shuls` does a bare `db.select().from(shuls)` on a public, unauthenticated endpoint.**
  Nothing leaks today. The moment anyone adds a denormalised `member_count` to `shuls` — the obvious
  optimisation once affiliation exists — it publishes to the open internet with no code change.
  Convert to an explicit column list **now**, while it is free.
- **CSV formula injection** in `admin/audit-log/page.tsx:117` — quote-doubling only, no guard on a
  leading `=`/`+`/`-`/`@`. Not exploitable today; becomes exploitable the moment anyone exports
  member-typed text. Three lines.
- **Registration baseline.** There is no analytics in the repo, so "watch completion after launch"
  is unmeasurable. Record weekly `count(users) group by week` for the 8 weeks before launch and put
  the number in this document.

---

## 10. Testing

Mutation-verified: every test is confirmed to fail against the unfixed code before it counts.

- **Normalisation** — entity decoding; the pinned punctuation rule, including `B'nai Torah` →
  `bnai torah`; empty results discarded; `Shaarei Shomayim` and `Shaarei Tefillah` do **not** collapse.
- **Status invariants** — all six statuses; `imported` + `shul_id` accepted; blank text rejected.
- **Shul deletion** — a linked member becomes `typed`/`imported`, keeps `shul_name_text`, **and the
  delete succeeds**. This test must be written to fail against the trigger-less design.
- **Import** — idempotent on re-run; alias decisions survive; `dismissed` resolves to unmatched;
  the dedup rule is deterministic for the 39 conflicting members; the email fallback reaches the
  193; the 9 unreachable are reported.
- **Back-linking** — ambiguous names never auto-apply; audit row written.
- **Privacy** — a fixture member with a sentinel `shul_name_text`; assert the sentinel appears in
  **no** response from `/api/shuls`, `/api/shuls/slug/[slug]`, `/api/blog`,
  `/api/blog/[slug]/comments`, `/api/search/suggestions?type=all`. A vague "no public endpoint
  returns affiliation" is not a test.
- **Deletion** — after `deleteUserWithContent`, no table retains a string that user supplied.
- **Registration** — a valid registration succeeds in each legal state, and the Google path still
  works. Revision 1 had no signup test at all, for the riskiest change in the spec.

---

## 11. Out of scope

Multiple shuls per member · shul managers seeing membership · public counts · notifying a shul when
someone affiliates · newsletter segmentation by shul · importing `MemberList.Address`/`City`/
`PostalCode`.

**Note on the opt-out split.** `none` and `private` are behaviourally identical today, and will
remain so while the items above are out of scope. The decision record justified the split partly by
"a person a shul might want to welcome" — a use this spec forbids. They are kept because they are
free and because `none` may become meaningful later, not because anything acts on it.

---

## 12. Risks

1. **The directory import is only as good as its review pass.** 166 candidates include office
   addresses. If the review is skipped, junk enters the public directory at scale. Mitigation:
   `--commit` refuses without a reviewed list.
2. **Two standards on completion** (required on the form, dismissible elsewhere) means overall
   coverage is unpredictable, and with no analytics it is also unmeasurable. Mitigation: the §9
   baseline, and the fact that the old site reached 70% by merely asking.
3. **Members see a 2010 answer.** Mitigated by `imported` status and the confirm card — but only for
   members who log in, and the import record itself notes most never will. The realistic outcome is
   that a large share stays `imported` indefinitely. That is acceptable **only** because `imported`
   is never presented as a current declaration.
4. **No email lever exists to refresh the cohort.** All broadcast opt-ins for imported members were
   deliberately switched off in July 2026 (2,220 rows), and 156 `RemoveMe` members have no
   subscriber row. Reversing that to send a "confirm your shul" email would undo a deliberate
   privacy decision. Recorded so a future session does not propose it as an easy win.
