---
name: atr-screens-shared-by-both-shells
description: Ask the Rabbi's four screens live in shared components rendered by both the admin panel and the dashboard, because the capability holder cannot reach /admin
type: decision
date: 2026-08-03
status: accepted
---

**Decision:** The four Ask the Rabbi screens — Submissions, Questions, New,
Comments — live in `src/components/ask-the-rabbi/manage/` and are rendered by
two thin shells: `/admin/programs/rabbi` and `/dashboard/ask-the-rabbi`. Neither
page owns a screen. The active tab is derived from `?tab=` and written back on
click, so notifications can deep-link and the URL is the source of truth.

**Context:** The admin panel's Ask the Rabbi tab was wired only to
`ask_the_rabbi_submissions`, a table that has **never received a row**, so it
rendered "No pending submissions found" and nothing else. The 5,521 published
Q&As, the composer, and a second copy of comment moderation lived on a dashboard
page the admin panel never linked to. Comment moderation existed twice against
the same API with different capabilities.

The binding constraint: the only holder of `canManageAskTheRabbi` is a `member`,
blocked from `/admin` by both middleware and the admin layout. A non-admin
surface has to keep existing, so consolidating everything into `/admin` was not
available without a permission change nobody wants for one person.

**Chose over:** promoting that user to `admin` (hands them users, businesses and
newsletters to solve one screen), and merely cross-linking the two pages (leaves
the duplication and the missing screens).

**Consequences:** The two shells default to different tabs on purpose — admin to
Submissions, dashboard to Questions — because the submissions table is empty and
landing the one non-admin manager on a permanently empty inbox would be a
downgrade. `AtrQuickPost` gained an `onPublished` callback: its `router.refresh()`
only refreshes server-rendered content, so publishing left the client-fetched
Questions list stale.

Related: [[atr-capability-not-admin-role]], [[userShuls-row-is-the-authority]]
