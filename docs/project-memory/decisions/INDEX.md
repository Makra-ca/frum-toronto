# Decision records

Newest first. One file per decision; see `.claude/skills/remember` in makra-crm
for the format.

| Date | Decision | File |
|---|---|---|
| 2026-08-06 | Printed shitos follow the site, not the old sheet | [printed-shitos-follow-the-site-not-the-old-sheet](2026-08-06-printed-shitos-follow-the-site-not-the-old-sheet.md) |
| 2026-08-06 | No zman reaches roundZman pre-rounded — it loses its rounding policy | [no-zman-reaches-roundzman-pre-rounded](2026-08-06-no-zman-reaches-roundzman-pre-rounded.md) |
| 2026-08-06 | Identity on a submission comes from the account, never the request body | [submitted-identity-comes-from-the-account](2026-08-06-submitted-identity-comes-from-the-account.md) |
| 2026-08-06 | The last-admin guard asks about the outcome, not "is this me" | [last-admin-guard-is-about-outcome](2026-08-06-last-admin-guard-is-about-outcome.md) |
| 2026-08-06 | Newsletter click destinations are signed, not allowlisted | [newsletter-links-are-signed-not-allowlisted](2026-08-06-newsletter-links-are-signed-not-allowlisted.md) |
| 2026-08-06 | A validation rule on a column applies to every write path, not just create | [create-and-edit-schemas-must-agree](2026-08-06-create-and-edit-schemas-must-agree.md) |
| 2026-08-05 | Corrections are proposals stored beside the live row, never over it | [corrections-are-proposals-not-overwrites](2026-08-05-corrections-are-proposals-not-overwrites.md) |
| 2026-08-05 | Every type stays live while a correction waits — one rule | [everything-stays-live-during-review](2026-08-05-everything-stays-live-during-review.md) |
| 2026-08-05 | Corrections are reviewed whole; per-field stays for businesses only | [corrections-reviewed-whole-not-per-field](2026-08-05-corrections-reviewed-whole-not-per-field.md) |
| 2026-08-05 | Businesses joins the shared corrections table later, not now | [businesses-join-corrections-later](2026-08-05-businesses-join-corrections-later.md) |
| 2026-08-05 | Forms collect what the directory needs to browse and search; plans gate the rest | [forms-collect-what-the-directory-needs](2026-08-05-forms-collect-what-the-directory-needs.md) |
| 2026-08-05 | Kosher status is never plan-gated — it feeds a filter and a facet | [kosher-is-never-plan-gated](2026-08-05-kosher-is-never-plan-gated.md) |
| 2026-08-05 | One shared businessInCategory() predicate; no call site filters on category_id | [one-predicate-for-category-membership](2026-08-05-one-predicate-for-category-membership.md) |
| 2026-08-05 | Category required on public submission; admins exempt from the plan limit | [category-required-admins-exempt](2026-08-05-category-required-admins-exempt.md) |
| 2026-08-05 | Session update re-reads claims from the database, not the client | [session-update-rereads-claims-from-the-database](2026-08-05-session-update-rereads-claims-from-the-database.md) |
| 2026-08-05 | Security findings written up with evidence, not fixed | [security-findings-written-up-not-fixed](2026-08-05-security-findings-written-up-not-fixed.md) |
| 2026-08-05 | The business work is two plans; finishing the fields comes first | [business-work-split-into-two-plans](2026-08-05-business-work-split-into-two-plans.md) |
| 2026-08-05 | Stop spec review when the errors stop changing decisions | [stop-spec-review-when-errors-stop-changing-decisions](2026-08-05-stop-spec-review-when-errors-stop-changing-decisions.md) |
| 2026-08-05 | The remember skill is installed globally | [remember-skill-installed-globally](2026-08-05-remember-skill-installed-globally.md) |
| 2026-08-05 | Tagline is ads copy, not a listing field; owners edit description | [tagline-is-ads-copy-not-a-listing-field](2026-08-05-tagline-is-ads-copy-not-a-listing-field.md) |
| 2026-08-04 | Claim before edit; only approved listings can be claimed | [claim-before-edit](2026-08-04-claim-before-edit.md) |
| 2026-08-04 | An owner's pending edit is stored separately so the listing stays live | [listing-stays-live-during-review](2026-08-04-listing-stays-live-during-review.md) |
| 2026-08-04 | Review is per field, with an optional per-field reason | [review-per-field-not-per-submission](2026-08-04-review-per-field-not-per-submission.md) |
| 2026-08-04 | The owner's editor shows only what their tier displays *(narrowed 2026-08-05 — excludes description, kosher, category)* | [owner-editor-matches-the-tier](2026-08-04-owner-editor-matches-the-tier.md) |
| 2026-08-04 | Dashboard access follows ownership, not role | [dashboard-access-follows-ownership](2026-08-04-dashboard-access-follows-ownership.md) |
| 2026-08-04 | Business review is admin-only; no capability added | [business-review-is-admin-only](2026-08-04-business-review-is-admin-only.md) |
| 2026-08-04 | Editable image is the logo; banner is an ads asset, gallery does not exist | [images-are-logo-only](2026-08-04-images-are-logo-and-banner-only.md) |
| 2026-08-04 | canAutoApproveBusinesses gates edits, not creation | [auto-approve-businesses-gates-edits-not-creation](2026-08-04-auto-approve-businesses-gates-edits-not-creation.md) |
| 2026-08-03 | Ask the Rabbi's four screens are shared components rendered by both shells | [atr-screens-shared-by-both-shells](2026-08-03-atr-screens-shared-by-both-shells.md) |
| 2026-08-03 | canManageAtr takes a Session and reads the DB, never the token flag | [atr-capability-not-admin-role](2026-08-03-atr-capability-not-admin-role.md) |
| 2026-08-03 | The userShuls row is the authority; assignment only ever promotes a member | [userShuls-row-is-the-authority](2026-08-03-userShuls-row-is-the-authority.md) |
| 2026-08-03 | The column default owns the byline; the fallback chain is deleted | [column-default-owns-the-byline](2026-08-03-column-default-owns-the-byline.md) |
| 2026-08-03 | The three dead permission toggles get wired up, not removed *(partially superseded)* | [dead-toggles-get-wired-not-removed](2026-08-03-dead-toggles-get-wired-not-removed.md) |
| 2026-08-03 | Notifications reach capability holders; shul-scoped rejected for now | [notify-capability-holders-not-just-admins](2026-08-03-notify-capability-holders-not-just-admins.md) |
| 2026-07-31 | Business self-editing blocked by ownership, not by a missing route | [business-claim-is-the-missing-step](2026-07-31-business-claim-is-the-missing-step.md) |
| 2026-07-31 | ~~Three dead permission toggles kept for now~~ *(superseded)*; the real gap is business owners cannot edit their listing | [business-owners-cannot-edit-their-listing](2026-07-31-business-owners-cannot-edit-their-listing.md) |
| 2026-07-31 | Missing permission controls are added to the admin panel, not granted by direct SQL | [grant-permissions-through-the-ui-not-sql](2026-07-31-grant-permissions-through-the-ui-not-sql.md) |
| 2026-07-31 | Rejection reason is an inline box in a dialog, a prompt only in a list | [rejection-reason-inline-not-prompt](2026-07-31-rejection-reason-inline-not-prompt.md) |
| 2026-07-31 | Admins auto-approve on every type, not five | [admins-auto-approve-every-type](2026-07-31-admins-auto-approve-every-type.md) |
| 2026-07-31 | Auto-approved kosher alerts announce on create | [kosher-alerts-announce-on-create](2026-07-31-kosher-alerts-announce-on-create.md) |
| 2026-07-31 | One config-driven edit form, not six hand-built pages *(provisional — unseen)* | [one-config-driven-edit-form](2026-07-31-one-config-driven-edit-form.md) |
| 2026-07-31 | Per-shul notifications parked; no way to follow a shul | [parked-per-shul-notifications](2026-07-31-parked-per-shul-notifications.md) |
| 2026-07-31 | A shul manager's edit keeps their shul's event live, but cannot publish or email | [shul-manager-edits-keep-events-live](2026-07-31-shul-manager-edits-keep-events-live.md) |
| 2026-07-31 | ~~Blog adopts the unpublish rule~~ *(superseded)*; main author granted auto-approve | [blog-adopts-unpublish-rule](2026-07-31-blog-adopts-unpublish-rule.md) |
| 2026-07-31 | Date-vs-instant is declared per type, never inferred at runtime | [declare-column-kind-never-infer-it](2026-07-31-declare-column-kind-never-infer-it.md) |
| 2026-07-31 | "Past" is by day for things that happen, by moment for things that expire | [is-past-day-for-events-instant-for-expiries](2026-07-31-is-past-day-for-events-instant-for-expiries.md) |
| 2026-07-31 | setApprovalStatus is the single writer of approval_status | [single-writer-for-approval-status](2026-07-31-single-writer-for-approval-status.md) |
| 2026-07-31 | broadcast_at, not transition rules, guarantees at most one announcement | [broadcast-at-is-the-real-guard](2026-07-31-broadcast-at-is-the-real-guard.md) |
| 2026-07-31 | Editing an approved item unpublishes it via a distinct pending_edit status | [edit-unpublishes-via-pending-edit](2026-07-31-edit-unpublishes-via-pending-edit.md) |
| 2026-08-02 | A newsletter series is its publisher string, not a category record | [publisher-is-the-grouping-key](2026-08-02-publisher-is-the-grouping-key.md) |
| 2026-08-02 | Publisher is chosen from a list; renames are exact, never fuzzy | [publisher-is-chosen-not-typed](2026-08-02-publisher-is-chosen-not-typed.md) |
| 2026-08-02 | Series headings appear only once most series have a back catalogue | [group-only-when-it-earns-its-place](2026-08-02-group-only-when-it-earns-its-place.md) |
| 2026-08-02 | A series link shows that series alone; an unknown slug is an empty state | [filtered-view-hides-the-other-section](2026-08-02-filtered-view-hides-the-other-section.md) |
