# Judgment calls logged for Daniel — user submissions build

Decisions I made without you, each with the reasoning, so you can overturn any of them cheaply.

## 1. The submissions list shows rows you OWN, not rows you may edit

`canEditRow` lets a shul's current manager edit the shul's event. The list query
filters on the owner column only, so a gabbai can edit the shul's event via a
direct link but it does not appear in *their* "My Submissions".

Reasoning: "My Submissions" reading as "things I submitted" is the plainer
meaning, and mixing in other people's rows would need a second, differently
labelled section to avoid confusion.

**If you want it:** a "My shul's submissions" section is a follow-up, not a
change to this one.

## 2. `/dashboard/blog` stays a separate, filtered view

The plan asked me to decide whether it redirects to the unified list. It stays.
Blog has its own TipTap editor, its own comment moderation control, and 3,058
owned posts — collapsing it into a generic list would lose the specialised
editor. Blog posts still appear in the unified list too, so nothing is hidden.

## 3. `/dashboard/tehillim` now overlaps the unified list

There is a pre-existing "My Tehillim Submissions" page and a link to it on the
dashboard, beside the new "My Submissions". Tehillim entries now appear in both.

I left both. Removing the older one is a product call, and it does things the
generic list does not.

## 4. The rejection reason reaches the queues, not every dialog

Added to: the approvals queue, ContentApprovalTabs, and the kosher-alert and
blog quick-reject buttons — the surfaces admins actually reject from.

NOT added to: the Select-driven edit dialogs (shiva, simchas, tehillim,
classifieds), where an admin can set the status to rejected without being
offered a reason field. They write null, which is a supported answer, so
nothing breaks — but a reason cannot be given from there.

## 5. The 409 guard catches double-writes, not the form-open race

Stated precisely because my first comment overclaimed. The edit reads the row
at save time, so an admin's approval that landed while the form was open is
already visible and the edit proceeds against it — which is the behaviour you
want. What the conditional write catches is two writes racing: a double submit,
two tabs, a retry after a client timeout.

Catching the form-open case needs the client to echo the version it loaded.
Nothing sends one today; adding it is a client change across every form.

## 6. Auto-approved kosher alerts now announce on create

Your call, recorded here because of what it grants: a holder of
`canAutoApproveKosherAlerts` can email every kosher-alert subscriber with no
admin in the loop. Consistent with events and shiva, and a recall that waits
for an admin is a recall nobody hears about.

## 7. Admins are auto-approvers on every type now

`community/shiva` and `community/tehillim` did not check `role === "admin"`
while the other five create routes did. Routing all seven through the shared
helper removed the difference. An admin posting a shiva notice through the
public form no longer waits in a queue behind their own approval.

## 8. One described form instead of six hand-built pages

The plan sized Chunk 3 as lifting four submission modals into routed pages. I
built one config-driven form instead. Less code, and it removes six independent
chances to forget the unpublish warning or bind a date column to the wrong
control. The cost: the six edit pages look uniform rather than mirroring each
modal's existing layout.

**I cannot visually verify any of it** — there is no admin password in this
environment and no browser check was possible.

## 9. `isPast` moved to day granularity

Was: an instant comparison. Now: the Toronto calendar day, so something running
today is never "past". This came out of a review finding — an all-day event is
stored at noon Toronto, so the old rule marked it finished at 12:01 on the day
it was running and removed the submitter's Edit button. It also now reads
`endTime` before `startTime`, so a multi-day event is judged on when it ends.

Side effect worth knowing: a classified or alert whose `expires_at` passes at
09:00 stays listed as current until midnight.

## 10. Two round trips, no transaction

`applyEdit` writes content, then `setApprovalStatus` writes the status. Those
are separate round trips because `drizzle-orm/neon-http` has no transaction
support at all.

If the connection drops between them, an edited item keeps its old status: the
user is told the save failed, and a retry self-heals. The window is real but
narrow, and closing it means moving the whole project to `Pool` +
`drizzle-orm/neon-serverless` — which your own rules already contemplate for
`db.transaction()`. Not something to change inside this feature.

## 11. Statuses read "Live" everywhere

The spec asked for per-type wording — "On the calendar" for events,
"Published" for blog. Everything currently says "Live". Cheap to add per-type
labels to `STATUS_STYLES` if you want them.

## 12. Alerts: I added the admin approve UI

Not in the plan as a task, but the audit found a member could submit an alert
and no admin surface could approve it — the list API did not even select
`approval_status`. It now shows a status badge and Approve/Reject buttons.
