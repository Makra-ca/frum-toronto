# Shul Affiliation — Design

**Date:** 2026-08-07
**Status:** Design, awaiting approval
**Trigger:** Daniel recalled that the legacy site asked members which shul they affiliate with, and asked whether we could check — and then surface it at signup and in the dashboard.

**Decision records:**
[typed-shuls-are-suggestions-not-shuls](../../project-memory/decisions/2026-08-07-typed-shuls-are-suggestions-not-shuls.md) ·
[shul-affiliation-is-private](../../project-memory/decisions/2026-08-07-shul-affiliation-is-private.md) ·
[legacy-shul-affiliation-is-imported-not-discarded](../../project-memory/decisions/2026-08-07-legacy-shul-affiliation-is-imported-not-discarded.md) ·
[shul-affiliation-is-required-with-honest-opt-outs](../../project-memory/decisions/2026-08-07-shul-affiliation-is-required-with-honest-opt-outs.md)

---

## 1. What is actually true

Every number below was measured against the live databases on 2026-08-07, not estimated.

**The legacy field exists and was never imported.** `FrumToronto.dbo.MemberList.ShulAffiliation`,
`nvarchar(100)`. The July 2026 member importer (`scripts/legacy-import/members.ts:114`) selects a
fixed list of 19 columns; this is not one of them. Nothing is lost — the legacy database is intact
and read-only — but the data is not in Postgres.

| Measurement | Value |
|---|---|
| `MemberList` rows | 3,307 |
| With a non-empty `ShulAffiliation` | **2,323 (70%)** |
| Distinct values | **585** |
| Rows containing HTML entities (`&#45;`, `&#47;`) | 92 |
| Longest value | 52 chars (column allows 100; **0 rows at the limit**) |
| `shuls` rows in Postgres | **14 total — 9 real**, 4 `[TEST]`, 1 `makra.ca` |
| Legacy values matching a shul exactly | 8 values / 108 members |
| Matching by prefix (clipped names) | 3 values / 27 members |
| **No match** | **574 values / 2,188 members** |

**The 25-character clipping is in the source data, not the column.** An early hypothesis was that
the column truncated. It does not — `nvarchar(100)`, longest value 52, nothing at the limit. The old
*form* clipped on write, so `Beth Avraham Yoseph of To` is permanently what is stored. It cannot be
repaired from the data, only by a human matching it to a real shul.

**The blocker is the directory, not the data.** 94% of affiliated members name a shul the site has
never heard of. A picker over 9 shuls is unusable; free text alone reproduces the 585-variant mess.

**Duplicates are semantic, not typographic.** `BAYT` (48 members) and `Beth Avraham Yoseph of To`
(187) are the same shul and share no common prefix. No string algorithm resolves that; a person does.

---

## 2. Data model

### 2.1 Three columns on `users`

```sql
ALTER TABLE users
  ADD COLUMN shul_id        integer REFERENCES shuls(id) ON DELETE SET NULL,
  ADD COLUMN shul_name_text varchar(150),
  ADD COLUMN shul_status    varchar(20) NOT NULL DEFAULT 'unset';
```

`shul_status` ∈ `listed | typed | none | private | unset`.

**Why a status column at all.** `shul_id IS NULL` is ambiguous across four distinct facts, and the
legacy import produces all of them simultaneously: *typed something we could not match*, *has no
shul*, *declined to answer*, *never asked*. Imported members are `unset` — they have not answered our
question — which is different from `private`.

**Why `shul_name_text` persists even when linked.** Three reasons: `ON DELETE SET NULL` would
otherwise blank a member when a shul is deleted, rather than degrading them to `typed`; the legacy
value survives verbatim as an audit trail; and a wrong auto-link is reversible because the original
answer is still there.

**Invariants** (enforced by CHECK, and declared in `schema.ts` so `db:push` cannot drop them —
see the ads work, where five constraints were silently droppable):

| `shul_status` | `shul_id` | `shul_name_text` |
|---|---|---|
| `listed` | NOT NULL | NOT NULL (denormalised name) |
| `typed` | NULL | NOT NULL |
| `none` / `private` / `unset` | NULL | NULL |

### 2.2 `shul_name_aliases`

```sql
CREATE TABLE shul_name_aliases (
  id              serial PRIMARY KEY,
  normalized_name varchar(150) NOT NULL UNIQUE,
  raw_example     varchar(150) NOT NULL,
  shul_id         integer REFERENCES shuls(id) ON DELETE CASCADE,
  status          varchar(20) NOT NULL DEFAULT 'pending',  -- pending | linked | dismissed
  decided_by      integer REFERENCES users(id) ON DELETE SET NULL,
  decided_at      timestamp,
  created_at      timestamp DEFAULT NOW(),
  CHECK (status <> 'linked' OR shul_id IS NOT NULL)
);
```

One table, three jobs:

1. **Variant resolution** — `BAYT` and `Beth Avraham Yoseph of To` both point at one `shul_id`.
2. **Dismissal that sticks** — `Kollel Toronto` and `JEP` are marked `dismissed` and stop
   reappearing in the suggestion queue.
3. **Future typed values** — a name already decided is applied without asking again.

`ON DELETE CASCADE` on `shul_id` is deliberate and differs from the `users` column: an alias exists
only to point at a shul, so if the shul goes, the alias is meaningless. A *member*, by contrast, must
survive.

---

## 3. Normalisation

One function, `src/lib/shul-names.ts`, used by the signup form, the importer, and the admin queue.
If these diverge, the same shul becomes two suggestions.

```
normalizeShulName(raw) =
  decode HTML entities (incl. the cp1252 numeric range — see htmlToText in scripts/legacy-import/lib.ts)
  → lowercase
  → strip punctuation
  → collapse whitespace
  → trim
```

`Aish HaTorah &#45; Thornhill` → `aish hatorah thornhill`. `shoavei mayim` and `Shoavei Mayim`
collapse to one row.

**Deliberately NOT done:** no stemming, no fuzzy distance, no stripping of `Congregation` /
`Synagogue` / `The`. Aggressive normalisation would merge genuinely distinct shuls
(`Shaarei Shomayim` and `Shaarei Tefillah` are different places). Merging is a human judgement,
recorded in `shul_name_aliases`.

---

## 4. Signup and dashboard

One shared component, `ShulAffiliationField`, used on the register form and in dashboard settings.

- A searchable picker over active shuls (the `UserPicker` / `BusinessPicker` pattern: debounced,
  AbortController, keyboard navigation).
- **My shul isn't listed** → reveals a text input.
- **I don't have a shul right now**
- **Prefer not to say**

Required at signup. Changeable any time from dashboard settings. One shul per member.

**Server-side**, `registerSchema` and the settings PATCH both validate that the submitted state is
one of the five legal `(status, shul_id, text)` combinations. A `shul_id` is checked to exist and be
active — hiding an option in a form is presentation, not a permission.

---

## 5. Legacy import

New script `scripts/legacy-import/shul-affiliations.ts`, following the existing conventions:
**dry-run by default**, `--commit` to write, `--limit=N` for a slice.

1. Read `MemberID, ShulAffiliation` from `MemberList` where non-empty.
2. Normalise.
3. Resolve, in order: an existing `shul_name_aliases` row → an exact normalised `shuls.name` match →
   otherwise unmatched.
4. Write to the `users` row matched via `email_subscribers.old_member_id` (the same join the member
   import used), setting either `shul_id` + `listed`, or `shul_name_text` + `typed`.
5. Create `pending` alias rows for every unmatched normalised name.

**Idempotent.** Re-running writes nothing new: matched on `old_member_id`, and it never overwrites a
row whose `shul_status` is anything other than `unset` — so a member who has since answered for
themselves is never reverted to their 2010 answer.

Expected: ~135 linked, ~2,190 typed, ~574 pending aliases.

---

## 6. Admin: `/admin/shuls/suggestions`

A new tab in the existing Shuls group. Rows are pending aliases ordered by member count:

```
187  Beth Avraham Yoseph of To    [ Create shul ]  [ Link to existing ▾ ]  [ Not a shul ]
104  Shomrai Shabbos Chevrah M    …
```

- **Create shul** — opens the existing shul form pre-filled with `raw_example`; on save, sets the
  alias to `linked` and back-links every member whose normalised text matches.
- **Link to existing** — the `BAYT` case.
- **Not a shul** — `dismissed`.

**Back-linking rules.** Exact normalised matches are applied. Near matches — specifically, a stored
value that is a *prefix* of the shul's normalised name, which is what the 25-character clipping
produces — are listed for confirmation and applied only on click. A clipped name is a guess, not a
fact: `Chabad Lubavitch Communit` could plausibly belong to more than one Chabad house.

Members' `shul_name_text` is retained after linking, so a wrong link is undoable.

---

## 7. Privacy

Visible to the member and to admins. Not on public profiles, not to shul managers, no counts on shul
pages. 2,323 of these values were given to a mailing list around 2010; consent cannot be back-dated.
Opening this up later is easy, closing it after exposure is not.

**Concretely:** no public API returns `shul_id`/`shul_name_text`; `/api/shuls/*` and the public shul
page gain nothing; the admin user table gains a column; the member sees their own in settings.

---

## 8. Cleanup

Delete the five junk `shuls` rows — `[TEST] Beth Jacob V'Anshei Drildz`, `[TEST] Chabad of Midtown`,
`[TEST] Sephardic Kehila Centre`, `[TEST] Shaarei Shomayim Congregation`, `makra.ca`. They are live
in production and would otherwise be pickable at signup.

**Check first:** each is referenced by `user_shuls`, `events`, `shiurim`, `davening_schedules`,
`shul_documents`. `user_shuls` currently holds exactly 1 row across all shuls. Anything referenced
gets deactivated rather than deleted.

---

## 9. Testing

Mutation-verified — every new test is confirmed to fail against the unfixed code before it counts
(the ads review found tests that passed against three separate injected bugs).

- **Normalisation**: entity decoding, the 92 affected rows, case collapsing, and that
  `Shaarei Shomayim` / `Shaarei Tefillah` do **not** collapse.
- **Status invariants**: all five legal combinations accepted, illegal ones rejected by the CHECK.
- **Import idempotency**: a second run writes nothing; a member who answered for themselves is not
  reverted.
- **Back-linking**: exact matches applied; prefix matches require confirmation; `shul_name_text`
  survives.
- **Shul deletion**: a linked member degrades to `typed`, is not blanked, and the delete succeeds
  (the ads work found `ON DELETE SET NULL` defeated by a CHECK — same shape, so it is tested here).
- **Privacy**: no public endpoint returns affiliation.

---

## 10. Out of scope

Multiple shuls per member · shul managers seeing their membership · public counts · notifying a shul
when someone affiliates · using affiliation for newsletter segmentation · importing
`MemberList.Address`/`City`/`PostalCode` (also never imported, also still available).

---

## 11. Risks

1. **Requiring the field may cost registrations.** No baseline exists for this form. Mitigation:
   the opt-outs are real answers, not friction; watch completion after launch.
2. **Members see a 16-year-old answer as current.** Mitigation: it is editable, and `unset`
   distinguishes "never asked" from "answered".
3. **The suggestion queue may never be worked.** 574 rows is a lot. Mitigation: it is ordered by
   member count, so the top 20 rows cover a disproportionate share of members — but if nobody works
   it, most members stay `typed` and the directory stays small. This is the main way the feature
   fails to deliver.
4. **`old_member_id` is the only join to legacy members.** Members who opted out of email have no
   `email_subscribers` row. The member import handled this with an email fallback; this importer
   must do the same or silently skip ~148 people.
