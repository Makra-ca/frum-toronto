---
name: corrections-are-proposals-not-overwrites
description: A submitter's correction is stored beside the live row, never over it, so rejecting one changes nothing
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** A correction to an already-approved item is written to a shared
`pending_changes` table, **never onto the live row**. The item stays visible and
unchanged while the correction waits. Approving applies it; rejecting leaves the
item exactly as it was.

Applies to the eight `SUBMISSION_TYPES`: event, simcha, classified, kosherAlert,
alert, shiva, tehillim, blog.

**Context:** `applyEdit` was a plain in-place `UPDATE`. The approved text was
destroyed the moment the submitter pressed Save, and because the row then became
`pending_edit`, the item also left the site. Rejecting stranded it there
permanently — off the site, holding text the admin had rejected, with no earlier
version anywhere.

Worth recording precisely, because it shaped the fix: **rejection deletes
nothing.** It writes only a status and a reason. The loss happens at Save. Any
fix aimed only at what rejection does could not have worked.

**Chose over** two cheaper options: telling the submitter honestly that their
item is gone (keeps losing data), and forbidding rejection of corrections
entirely (removes the data-loss path but makes every correction the admin's
editing work, and items still vanish while awaiting review).

**Consequences:** Corrections never change the item's status, so the
re-broadcast problem `pending_edit` was invented to solve cannot arise —
the status never leaves `approved`. `pending_edit` becomes unreachable, leaving
dead filter options in five admin pages to tidy up.

Sub-rules: a newer correction replaces an older one, whoever submitted it; an
item that is not yet approved is edited directly, since it is not on the site; a
**rejected** item returns to `pending` on edit even for a trusted submitter,
preserving the existing rule that an auto-approver cannot overturn a rejection.

Measured before deciding: **zero items stuck** — no `pending_edit` and no
`rejected` rows in any of the eight tables. The trap was armed and had not fired,
so the correct fix was available rather than a triage.

Related: [[everything-stays-live-during-review]],
[[corrections-reviewed-whole-not-per-field]]
