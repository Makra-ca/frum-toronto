---
name: kosher-alerts-announce-on-create
description: An auto-approved kosher alert emails subscribers immediately, matching events and shiva
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** A kosher alert created by someone with `canAutoApproveKosherAlerts`
goes live AND announces to kosher-alert subscribers, stamping `broadcast_at`.

**Context:** Events and shiva notices announce on an auto-approved create;
kosher alerts went live silently. Three announcing types, two behaviours.

**Chose over:** keeping them silent, or removing the announcement from events
and shiva so only an admin approval ever mass-emails.

**Consequences:** A holder of the flag can email every kosher-alert subscriber
with no admin in the loop. Accepted deliberately: a recall that waits for an
admin is a recall nobody hears about. The flag is admin-granted and
admin-revocable, and `broadcast_at` still means at most one email per alert.

Related: [[broadcast-at-is-the-real-guard]]
