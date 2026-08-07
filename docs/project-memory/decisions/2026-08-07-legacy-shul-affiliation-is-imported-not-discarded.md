---
name: legacy-shul-affiliation-is-imported-not-discarded
description: The 2,323 legacy ShulAffiliation values are imported as text, matched where possible, and used as the worklist for building the shul directory
type: decision
date: 2026-08-07
status: accepted
originSessionId: 415c321c-22e2-44e7-9590-782e530aa276
---

**Decision:** Import `FrumToronto.dbo.MemberList.ShulAffiliation` into the new `users` table:
link to a `shuls` row where the normalised name matches, otherwise store the text with
`shul_status = 'typed'`. The unmatched values, ranked by member count, become the worklist for
populating the shul directory.

**Context:** The July 2026 member import selected a fixed list of 19 columns and
`ShulAffiliation` was not among them, so it never came across. Nothing was lost — the legacy
database is intact and read-only — but the data sat unused. It covers **2,323 of 3,307
members (70%)**, which is a better inventory of Toronto shuls than the site's own 9-entry
directory.

Measured before deciding: 585 distinct values; 92 rows carrying HTML entities (`&#45;`,
`&#47;`) from the same encoding damage found in the simcha import; many values clipped to 25
characters — **by the old form on write, not by the column**, which is `nvarchar(100)` with a
longest value of 52, so the clipping is permanent in the source. Roughly 135 members match an
existing shul; ~2,190 will land as typed.

**Chose over:**
- *Not importing, and asking members to re-enter* — cleanest data, and the information is up
  to 16 years old, but most of these members will never log in again, so it would discard a
  70%-complete picture for a field that would then sit near-empty.
- *Importing as text with no matching* — moves the 585-variant mess into Postgres unchanged.
- *Importing as an admin-only historical note* — avoids presenting stale data back as current
  fact, but wastes the directory-building signal.

**Consequences:**
- Members see their legacy answer as their current affiliation. It may be stale; the dashboard
  lets them change it, and that is the mitigation.
- The importer must share one normaliser with the signup form (decode entities, lowercase,
  strip punctuation, collapse whitespace) or the same shul becomes two suggestions.
- Dry-run by default, like every other script in `scripts/legacy-import/`.
- The five junk rows in `shuls` (four `[TEST]` entries and `makra.ca`) are deleted as part of
  this work — they are live in production today and would otherwise be pickable at signup.

Related: [[typed-shuls-are-suggestions-not-shuls]], [[shul-affiliation-is-required-with-honest-opt-outs]]
