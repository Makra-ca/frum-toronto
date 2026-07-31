---
name: parked-per-shul-notifications
description: Following a specific shul does not exist and is deliberately not being built now
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Parked. Event announcements stay a single site-wide
`community_events` opt-in.

**Context:** The question arose from "if it's a shul's event, shouldn't it be
part of the shul?" — which implies people could follow a shul. They cannot.
`email_subscribers` has no shul-related column; the shul link on an event has no
effect on who is emailed. Every event goes to the same 49 subscribers.

**Chose over:** building it as part of the submissions work. It is a genuinely
separate feature — a subscription table keyed by shul, a follow control on the
shul page, a decision about whether shul events go to followers instead of or
in addition to the community list, per-shul unsubscribe handling, and a
management surface in dashboard settings.

**Consequences:** Until it exists, "trusted for this shul" cannot mean "may
notify that shul's people", which is why the shul-manager decision grants no
emailing power. If built later it would likely carry more than events — shul
newsletters, davening changes, shiurim.

Related: [[shul-manager-edits-keep-events-live]]
