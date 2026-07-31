---
name: rejection-reason-inline-not-prompt
description: A rejection reason is an inline box in a detail dialog, and a browser prompt only in a list
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Rejecting from the approvals queue asks for a reason with a
browser prompt; rejecting from an item's edit dialog uses an inline text box
that appears once the status is set to rejected. Two patterns, on purpose.

**Context:** The shiva edit dialog could set a status to rejected through a
dropdown and never asked why, so the submitter received the generic fallback
copy even when the admin had a reason in mind — on the one screen where they
are reading the notice in most detail.

**Chose over:** reusing the browser prompt everywhere for consistency. A prompt
is dismissed by reflex, and cancelling it means the rejection does not happen —
harmless in a list where you notice the row did not move, misleading in a
dialog where the status is already selected and your finger is on Save. Inline
also lets the admin read the notice while writing, and allows more than one
line.

**Consequences:** Two patterns for the same idea, justified by context: a quick
action in a list, a considered one in a form. The box is prefilled from the
stored reason so correcting the wording does not blank it.

**Correction:** I claimed FOUR dialogs had this gap (shiva, simchas, tehillim,
classifieds). Only shiva does — the other three admin pages have no reject
action at all and rejection happens through the queue, which already prompts.
The claim came from an audit and was repeated without checking.
