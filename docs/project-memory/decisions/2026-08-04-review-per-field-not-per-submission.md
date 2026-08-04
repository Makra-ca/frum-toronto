---
name: review-per-field-not-per-submission
description: An owner's edit is approved field by field with an optional per-field reason, and the owner is told which fields were turned down
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** The admin approves a pending change **field by field** — a tick
beside each changed value. Approving writes only the ticked fields. Each unticked
field takes an **optional** rejection reason. The owner is told which fields went
live, which did not, and why where a reason was given.

**Context:** The worked example that settled it: a bakery corrects its phone,
Friday hours, website and street number, and also rewrites its description to
attack competitors. Four good corrections, one bad field.

**Chose over two alternatives:**

- **All-or-nothing.** Simpler to build, but rejecting throws away four accurate
  corrections because of one bad one, and the address stays wrong on the site
  until they resubmit. The honest outcome is that the admin would edit the
  description himself and approve — which is the next option in disguise.
- **An editable review screen** — admin fixes the text, then approves. Most
  flexible and closest to today's habit, but it requires building the full edit
  form a second time (a read-only diff with checkboxes is *less* work, not more),
  and it rewrites the owner's words without telling them.

**Consequences:** The reason is optional because most rejections are
self-evident, and a mandatory sentence is how a review queue stops getting
cleared. With no reason the owner still learns *which* field, which is enough to
try again — they know what they wrote.

Silence was rejected outright: an owner who cannot tell whether a change was seen
resubmits it, so silence generates the work it appears to save.

Matches [[rejection-reason-inline-not-prompt]].

Related: [[listing-stays-live-during-review]]
