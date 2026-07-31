---
name: one-config-driven-edit-form
description: Six per-type edit pages are generated from one described form rather than hand-built from the existing modals
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** One form component plus a per-type field description, behind six
thin pages — rather than lifting each existing submission modal into its own
routed edit page.

**Context:** Six types need an edit page. The plan sized this as converting four
modals (shiva, kosher alerts, simchas, alerts) into pages. Each such page is a
place to forget the "saving takes this off the site" warning, bind a DATE column
to the wrong control, or render a field the API will refuse to write.

**Chose over:** six hand-built pages mirroring the modals. Those would look
familiar to people who already use the submission pop-ups, which is a real
benefit given nobody has seen the generic ones.

**Consequences:** The six pages look uniform rather than like their modals.
Tests assert every described field is writable by the API and that every folder
matches the link the dashboard emits, so the form cannot offer a dead control.
**Provisional** — Daniel has not seen them rendered, and there was no way to
check in the build environment. Revisit after a look.

Related: [[edit-unpublishes-via-pending-edit]]
