# Decision records

Newest first. One file per decision; see `.claude/skills/remember` in makra-crm
for the format.

| Date | Decision | File |
|---|---|---|
| 2026-07-31 | Three dead permission toggles kept for now; the real gap is business owners cannot edit their listing | [business-owners-cannot-edit-their-listing](2026-07-31-business-owners-cannot-edit-their-listing.md) |
| 2026-07-31 | Missing permission controls are added to the admin panel, not granted by direct SQL | [grant-permissions-through-the-ui-not-sql](2026-07-31-grant-permissions-through-the-ui-not-sql.md) |
| 2026-07-31 | Rejection reason is an inline box in a dialog, a prompt only in a list | [rejection-reason-inline-not-prompt](2026-07-31-rejection-reason-inline-not-prompt.md) |
| 2026-07-31 | Admins auto-approve on every type, not five | [admins-auto-approve-every-type](2026-07-31-admins-auto-approve-every-type.md) |
| 2026-07-31 | Auto-approved kosher alerts announce on create | [kosher-alerts-announce-on-create](2026-07-31-kosher-alerts-announce-on-create.md) |
| 2026-07-31 | One config-driven edit form, not six hand-built pages *(provisional — unseen)* | [one-config-driven-edit-form](2026-07-31-one-config-driven-edit-form.md) |
| 2026-07-31 | Per-shul notifications parked; no way to follow a shul | [parked-per-shul-notifications](2026-07-31-parked-per-shul-notifications.md) |
| 2026-07-31 | A shul manager's edit keeps their shul's event live, but cannot publish or email | [shul-manager-edits-keep-events-live](2026-07-31-shul-manager-edits-keep-events-live.md) |
| 2026-07-31 | Blog adopts the unpublish rule; main author granted auto-approve | [blog-adopts-unpublish-rule](2026-07-31-blog-adopts-unpublish-rule.md) |
| 2026-07-31 | Date-vs-instant is declared per type, never inferred at runtime | [declare-column-kind-never-infer-it](2026-07-31-declare-column-kind-never-infer-it.md) |
| 2026-07-31 | "Past" is by day for things that happen, by moment for things that expire | [is-past-day-for-events-instant-for-expiries](2026-07-31-is-past-day-for-events-instant-for-expiries.md) |
| 2026-07-31 | setApprovalStatus is the single writer of approval_status | [single-writer-for-approval-status](2026-07-31-single-writer-for-approval-status.md) |
| 2026-07-31 | broadcast_at, not transition rules, guarantees at most one announcement | [broadcast-at-is-the-real-guard](2026-07-31-broadcast-at-is-the-real-guard.md) |
| 2026-07-31 | Editing an approved item unpublishes it via a distinct pending_edit status | [edit-unpublishes-via-pending-edit](2026-07-31-edit-unpublishes-via-pending-edit.md) |
