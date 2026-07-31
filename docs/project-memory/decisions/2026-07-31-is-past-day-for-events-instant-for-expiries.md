---
name: is-past-day-for-events-instant-for-expiries
description: Things that happen are judged past by their Toronto day; things that expire are judged by the moment
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Events and shiva notices are not "past" until their day is over,
in Toronto. Classifieds and alerts are past the moment `expires_at` passes.

**Context:** An all-day event is stored at noon Toronto, so an instant
comparison marked it finished at 12:01 on the day it was running — hiding it
behind the "show past" toggle and taking away the submitter's Edit button
mid-event. Events also ignored `endTime`, so a three-day event counted as over
on its opening night.

**Chose over:** day granularity everywhere, which was the first fix and is what
this narrows. Applying it to `expires_at` would have kept an expired classified
listed as current until midnight, and the moment is precisely what that column
is for. Also over reverting to instants everywhere, which is the bug.

**Consequences:** Two rules to hold in mind, declared per type as
`pastPrecision`. Tehillim is nominally an expiry but its column is a DATE, which
cannot express a moment, so it is judged by day. Events read `endTime` before
`startTime`.

Related: [[declare-column-kind-never-infer-it]]
