---
name: shul-manager-edits-keep-events-live
description: A shul manager editing their shul's already-live event keeps it live, but gains no power to publish or to email
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** When a shul's current manager edits that shul's event: if it is
live it stays live, and if it is pending it stays pending.

**Context:** A gabbai changing their shul's davening time, address or documents
goes live instantly with no review — that is long-standing behaviour. But an
event is a submission, so the same gabbai fixing a typo in the shul's event had
it taken off the calendar until an admin approved. Same person, same shul, two
behaviours, nothing on screen explaining why.

**Chose over:** full auto-approve for that shul's events. That looked like the
consistent answer until the data was checked: there is **no per-shul
subscription anywhere** — a single global `community_events` toggle, currently
49 people. So a gabbai publishing an event would not be notifying "their shul's
followers", they would be emailing everyone, most with no connection to that
shul. Also over leaving it alone, which keeps the inconsistency.

**Consequences:** Their corrections never unpublish and never email. Publishing
a genuinely new shul event still goes through an admin. Currently affects zero
rows — one shul manager exists and no shul-linked event is in the future — so
this is coherence, not urgency.

Related: [[parked-per-shul-notifications]]
