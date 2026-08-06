---
name: unverified-is-not-a-proxy-for-bot
description: The bulk-cleanup cohort is defined by owning nothing, not by being unverified
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** The "clear bot signups" cohort requires **three** conditions
together: unverified, created within 30 days, **and owning nothing in any
table**. Ownership is the safety property; the other two only narrow the set.

**Context:** The obvious query is "delete the unverified accounts". It is also
the one that would have destroyed the client's own work:

> **`rochel@frumtoronto.com` (id 9) is unverified and owns 1,395 blog posts.**

She signs in as `admin@frumtoronto.com`; id 9 is the import-created account that
owns her articles. 86 accounts are unverified in total. A sweep of all of them
deletes the site's main author and every article attributed to her.

Measured 2026-08-06: the three-condition cohort returns **82** accounts, all
keyboard-mash names on scraped addresses (`Ojocio Vrlqeuinv`, `Qtef Kpubeko`).
Rochel, the admin, and the Archive account are all correctly absent.

**Chose over:**

- *Unverified alone.* The disaster case above.
- *Unverified + recent.* Better, and still wrong in principle — it happens to
  exclude id 9 only because she is old, so the safety would be an accident of
  timing rather than a property of the query.
- *A name/address heuristic* (keyboard-mash detection, disposable-domain lists).
  Fuzzy, and it fails in the dangerous direction: a real member with an unusual
  name is indistinguishable from a bot to a regex.

Ownership is the only condition that is *categorically* safe: an account that
has never posted anything cannot be a contributor, whatever else is true of it.

**Consequences:**

- Checked against all 19 blocking tables **plus** `ask_the_rabbi_comments`,
  which the database would destroy silently — so an account with only ATR
  comments is excluded too, even though nothing would have blocked its deletion.
- **The 30-day window is deliberately narrow and not adjustable in the UI.**
  Widening it starts to include long-standing unverified accounts, id 9 among
  them. It is a second line of defence, not a preference.
- The dialog lists every candidate with name, address and join date, all ticked
  by default. The decision is made on evidence rather than on a count.
- Deletion still goes one at a time through the guarded, audited endpoint. The
  cohort query decides what to *offer*, never what to remove.
- `tests/admin-spam-cohort.test.ts` pins this, including a positive control —
  without one, every exclusion test would pass against a function that returned
  an empty array. Verified by removing the ownership clause and watching the
  Rochel assertion go red.

Related: [[deleting-a-user-asks-about-their-content]]
