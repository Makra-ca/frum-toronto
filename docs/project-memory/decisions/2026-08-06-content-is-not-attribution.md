---
name: content-is-not-attribution
description: A row referencing a user is either their content or a record that they acted on someone else's — purge deletes the first and never the second
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** The 19 foreign keys that block a user deletion are split into two
lists (`src/lib/admin/user-deletion-tables.ts`):

- **`CONTENT_TABLES` (12)** — things the person authored. `purge` deletes them;
  `reassign` moves the two NOT NULL ones to the Archive account and clears the
  rest.
- **`ATTRIBUTION_TABLES` (7)** — records that the person *acted on* something
  that is not theirs: `reviewed_by`, `uploaded_by`, `updated_by`, `created_by`,
  `assigned_by`. **Never deleted, in any mode.** Only the reference is cleared.

**Context:** The first implementation used one list and ran
`DELETE FROM <table> WHERE <column> = ?` across all 19 in purge mode. That does
not delete the user's content. It deletes:

- the community's entire eruv up/down history, because they updated it
- somebody else's Ask the Rabbi question, because they reviewed it
- a shul's newsletters and documents, because they uploaded them
- **another user's shul-manager access**, via `user_shuls.assigned_by`

Found by a review from a second session working the same repo. Never fired:
every attribution row is currently held by the admin account, which deletion
refuses outright. **The guard that saved it was unrelated to the bug** — which
is the reason it was fixed rather than accepted as low-risk. Any change to the
admin refusal, or any non-admin being given content-manager duties, arms it
silently.

**Chose over:**

- *Leaving one list and excluding attribution only in purge.* The lists are the
  documentation; keeping the distinction implicit in a branch is how it gets
  lost again.
- *Making purge always null everything.* Then purge stops meaning "remove their
  content", which is the whole reason the mode exists.

**Consequences:**

- The inventory returns `owned` and `attributed` **separately**, and
  `totalOwned` counts content only — so attribution alone never triggers the
  "choose a mode" 409, because there is nothing to choose.
- The dialog shows attribution in its own panel: *"These records stay — only the
  name is removed."* This is the point. For content the admin reads "3
  classifieds" and can decide; **"47 eruv updates" gives no hint that agreeing
  destroys community records. A choice offered against a misleading label is not
  a choice.**
- `ask_the_rabbi_submissions` appears on **both** lists — `user_id` is the
  person's own question, `reviewed_by` is someone else's. Same table, opposite
  sides. Pinned by a test.
- Attribution entries must all be `onReassign: "null"`. A NOT NULL attribution
  column would be unhandleable — neither nullable nor deletable. None exists;
  a test catches one being added.
- Verified by reinstating the bug and watching the integration test go red.

Related: [[deleting-a-user-asks-about-their-content]]
