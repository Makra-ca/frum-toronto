---
name: blog-adopts-unpublish-rule
description: Blog follows the same editing rule as every other type, with auto-approve granted to the main author as the mitigation
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Blog's rule — "only pending or rejected posts can be edited" —
is replaced by the site-wide one: editing a published post unpublishes it until
an admin approves. `rochel@frumtoronto.com` is granted `canAutoApproveBlog` so
her edits stay live.

**Context:** Blog's old rule was the opposite of every other type and meant an
author could never fix a typo in a published post at all. But blog is 99% of
this feature — 3,058 owned posts against 30 for everything else combined — and
its main author owns 1,395 published posts as a plain `member` with no
auto-approve. Applied unchanged, the new rule would take a live post off the
site on every typo fix, waiting on the site's single admin.

**Chose over:** exempting blog from the unpublish rule, which keeps two
policies in the codebase forever. The auto-approve grant achieves the same
outcome for the person it affects while leaving one rule.

**Consequences:** The grant is broad — Rochel's NEW posts also go live without
review, not just corrections. `halachafortoday@yahoo.com` (1,011 posts) is in an
identical position and was NOT granted it; their edits still unpublish. Blog was
sequenced last deliberately, after the pattern was proven on smaller types.

Related: [[edit-unpublishes-via-pending-edit]]
