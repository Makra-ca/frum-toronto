---
name: notify-capability-holders-not-just-admins
description: Ask the Rabbi notifications will reach capability holders as well as admins; shul-scoped notifications explicitly rejected
type: decision
date: 2026-08-03
status: accepted
---

**Decision:** `createAdminNotification` will resolve recipients as **admins ∪
holders of the capability that governs that content type**, via a
`contentType → capability` map beside the existing `FORM_TYPE_BY_CONTENT`. Scope
is Ask the Rabbi only. Not yet built.

**Context:** `notifications.ts:40-43` targets `role = "admin"` and nothing else.
The Ask the Rabbi consolidation shipped a working submissions inbox to a
`member` who has **no way to learn anything landed in it** — and all three
notification `linkUrl`s point at `/admin`, which middleware bounces him from.
The screen shipped without the signal.

Of the 14 capability columns, **only `canManageAskTheRabbi` grants review
authority over other people's content**. The other thirteen are
`canAutoApprove*` / `canPostSpecials`, which govern your *own* submissions and
therefore create no work queue and need no incoming notification. So one map
entry closes the whole present-day gap.

**Chose over:** also routing shul-scoped types (`shul_edit`, `davening_edit`,
`shul_document`, shul-linked `event`) to that shul's managers. Rejected on the
data: only admins and a shul's own managers can edit a shul at all, and with one
manager per shul the only real case is "the admin edited it". Measured — 14
shuls, 1 assignment, and that one is a **test account on a test shul**; zero
registration requests ever. Building notification routing for zero real users.

**Consequences:** His notification must point at
`/dashboard/ask-the-rabbi?tab=submissions`, not the admin URL. Live updates need
more than the map: Pusher broadcasts on a single `private-admin-notifications`
channel authorised `role === "admin"`, so a non-admin reviewer would get correct
database rows and no live push.

Revisit the shul half after [[shul-manager-delegation]] ships, when a shul can
have more than one manager.
