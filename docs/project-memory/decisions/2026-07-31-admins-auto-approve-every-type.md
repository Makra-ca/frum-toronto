---
name: admins-auto-approve-every-type
description: An admin submitting through a public form is auto-approved on all eight types, not five
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** `role === "admin"` counts as auto-approve for every submission
type.

**Context:** Five of the seven public create routes checked for admin;
`community/shiva` and `community/tehillim` did not. An admin posting a shiva
notice through the public form landed in the queue, waiting on their own
approval.

**Chose over:** leaving shiva and tehillim conservative on the grounds that
bereavement notices deserve a second pair of eyes even from an admin. Rejected
because there is one admin on the site — the second pair of eyes is the same
pair.

**Consequences:** Both create and edit resolve status through one helper, so
the two cannot drift again. An admin's shiva notice now also announces
immediately, since an auto-approved create broadcasts.

Related: [[single-writer-for-approval-status]]
