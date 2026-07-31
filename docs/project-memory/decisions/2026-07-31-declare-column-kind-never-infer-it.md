---
name: declare-column-kind-never-infer-it
description: Whether a value is a calendar date or an instant is declared in config, never inferred from its runtime type
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Each submission type declares `detailKind` and `pastKind`
(`"date"` or `"instant"`). Tests cross-check both against the real Drizzle
column type.

**Context:** `typeof value === "string"` happens to identify a DATE column
today, but only because `drizzle-orm/neon-http` installs a raw parser for oid
1082 — it is the only driver in the package that does. This project's own rules
require moving to `Pool` + `neon-serverless` the moment `db.transaction()` is
needed, and on that day DATE columns start arriving as Dates at LOCAL midnight.
A shiva notice sitting today would read "past" before dawn.

**Chose over:** branching on the runtime type, which works now and fails
silently later, in production only.

**Consequences:** Adding a type means declaring both kinds; a wrong declaration
fails a test rather than shipping. This is the same class of bug as the
2026-07-30 timezone incident, guarded structurally rather than by care.

Related: [[is-past-day-for-events-instant-for-expiries]]
