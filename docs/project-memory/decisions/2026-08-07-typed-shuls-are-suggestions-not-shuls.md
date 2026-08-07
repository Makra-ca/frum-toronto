---
name: typed-shuls-are-suggestions-not-shuls
description: A shul a member types at signup becomes an admin suggestion, never an auto-created directory entry
type: decision
date: 2026-08-07
status: accepted
originSessionId: 415c321c-22e2-44e7-9590-782e530aa276
---

**Decision:** When a member types a shul that is not in the directory, it is stored on
their profile and surfaced to admins as a ranked suggestion. It does **not** create a
`shuls` row. An admin either creates the shul, links the name to an existing shul, or
dismisses it. A `shul_name_aliases` table records that judgement so the same spelling is
never re-decided.

**Context:** The `shuls` directory has 9 real entries. The legacy `MemberList.ShulAffiliation`
field shows members naming **585 distinct shuls** across 2,323 people. So a picker alone
cannot work — 94% of existing members belong to somewhere the site has never heard of —
but a free-text field alone reproduces the mess the old site had.

**Chose over:**
- *Auto-creating a shul from typed text* — a directory entry is a real page with a rabbi,
  address, davening times and documents; a name typed into a signup box has none of that.
  It would also immediately produce duplicates (`BAYT` and `Beth Avraham Yoseph of To` are
  the same shul, 48 and 187 members respectively) and let anyone write to a public
  directory from an unauthenticated-adjacent form.
- *Storing the text and doing nothing else* — you would only learn which shuls are missing
  by reading the database.

**Consequences:**
- The public directory only ever contains shuls an admin approved.
- The alias table is what lets two spellings resolve to one shul, and what makes "no, that
  is not a shul" (e.g. `Kollel Toronto`, `JEP`) stick.
- Adding a shul back-links members whose typed name matches. Exact and near matches are
  applied; ambiguous ones are shown for confirmation, because ~25-character clipped values
  like `Shomrai Shabbos Chevrah M` are a guess, not a fact.
- `shul_name_text` is retained even once linked, so a wrong auto-link is reversible.

Related: [[legacy-shul-affiliation-is-imported-not-discarded]], [[shul-affiliation-is-private]]
