---
name: approvals-queue-is-editable
description: The Approvals queue gets its own focused editor for all four types, rather than reusing each type's full editor
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Every card on `/admin/approvals` — Simchas, Events, Classifieds,
Tehillim — has an **Edit** button beside Approve and Reject. It opens a purpose-
built editor covering the fields most likely to need correcting, not the type's
full admin form.

Saving never changes `approval_status`. The item stays in the queue; approving
is a separate, deliberate click.

**Context:** The queue was read-only. An event submitted with the wrong time
could only be approved wrong, rejected (which emails the submitter a rejection),
or fixed by leaving the queue, navigating to Programs → Events, finding it again
and editing there. The same applied to all four tabs.

**Chose over:**

- *Reusing each type's existing editor.* Three of the four are inline dialogs
  inside 600–800 line page files, not reusable components. Extracting them is a
  large refactor of pages that work.
- *A deep link to the full editor.* Lighter, but the admin still leaves the
  queue and loses their place mid-review.
- *Leaving it read-only.* Defensible — but then anything needing a small fix
  cannot be resolved from the queue at all.

The job is genuinely different: in the queue you are fixing a typo or a wrong
time before saying yes, not restructuring a record. The full editor stays one
click away for anything larger.

**Consequences:**

- Fields were chosen **against the PATCH schemas, then round-trip tested** —
  every one is written and read back from the database. All four schemas are
  `z.object`, which silently strips unknown keys, so a mistyped field name
  produces a save that returns 200, says "Changes saved", and changes nothing.
  That has already shipped twice here.
- **`approvalStatus` is stripped from the payload**, and all four routes only act
  on it when present. Two guards, because a status moving as a side effect of an
  edit is how a re-broadcast happens.
- Two traps found only by testing, not by reading the schemas:
  `classifieds.price` is typed `z.string()` over a `numeric(·,2)` column, so
  free text 500s; and the events PATCH validates with `eventSchema.parse()`,
  which is **not** partial.
- **A name collision was created**: `EDITABLE_FIELDS` now exists in both
  `@/components/admin/approvals/approval-edit-fields` (this feature) and
  `@/lib/submissions/editable-fields` (member editing). Different shapes, not
  interchangeable.

Related: [[create-and-edit-schemas-must-agree]]
