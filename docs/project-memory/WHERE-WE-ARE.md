# Where we are — 2026-07-31

Status, not decisions. Decisions live in `decisions/` with their reasoning;
this is the running state of the work so a session can be picked up cold.

## The main thread: user submissions

**Branch `feature/submissions-impl` in the `../ft-subs` worktree. Not merged,
not pushed.**

Users can see, edit and hear back about everything they submit, across all
eight content types. Chunks 0–4 of the plan are complete.

**Verified:** 518 unit + 388 integration tests, `tsc` clean, eslint at the
49-error baseline, `next build` compiles, migrations applied to primary and the
Neon test branch.

**Documents:**
- Spec: `docs/superpowers/specs/2026-07-30-user-submissions-design.md`
- Plan: `docs/superpowers/plans/2026-07-30-user-submissions.md`
- Decisions: `docs/project-memory/decisions/`
- Judgment calls: `docs/superpowers/2026-07-30-submissions-judgment-calls.md`

### Confirmed and built since the review

1. "Past" split — things that happen end at midnight, things that expire end at
   their moment
2. Rejection reason as an inline box in the shiva edit dialog
3. A shul manager's correction keeps their shul's event live
4. `canAutoApproveBlog` added to the admin permissions dialog and route

### Still open on this thread

- **Rochel's blog auto-approve** — the control now exists in the admin panel;
  Daniel grants it. `halachafortoday@yahoo.com` (1,011 posts) is in the same
  position and undecided.
- **Submitter messages** — an approval after a correction still says "Your
  event is live" rather than "Your change is live". Agreed to fix, not built.
- **Daily digest** — does not distinguish corrections from new submissions.
  Undecided.
- **Submitters are never told when an ADMIN edits their item.** Undecided.
- **The edit-form approach** — one config-driven form vs six pages mirroring
  the existing modals. Daniel has not seen the pages rendered; my offer to run
  the dev server is open. Recorded as provisional.
- **Merging and pushing.** Nothing is pushed. Doing so also deploys the
  timezone fix and the ads session's work already sitting unpushed on `main`,
  and makes the `$onUpdate` change to 17 `updated_at` columns user-visible.

## The new thread: business ownership

Opened by asking why the "Business Listings" permission toggle does nothing.

**Finding:** 1,633 businesses, none with an owner account; zero subscriptions
ever created; no owner-facing edit route. The paid directory is built and never
launched.

**Intent:** build a claim flow so a business owner can be linked to the listing
that already exists. Brainstorm started, nothing designed yet.

See `decisions/2026-07-31-business-claim-is-the-missing-step.md`.

## Known gaps not being worked on

- Three permission toggles (Ask the Rabbi, Business Listings, Shul Directory)
  appear in the admin dialog, save, and are read by nothing.
- No per-shul notifications — a single global `community_events` opt-in, 49
  subscribers. Parked deliberately.
- `isTrusted` is set on 22 users who own zero businesses between them; it is a
  leftover from the pre-per-type permission system.

## Environment notes

- The Neon test branch credential rotates. `.env.test` and `TEST_DB_ENDPOINT`
  in `tests/setup.ts` must name the same endpoint or every integration run
  aborts. Current: `ep-still-block-ahs6wvfm`.
- `next build` in the worktree needs `cp -al` over the symlinked
  `node_modules` — Turbopack rejects the symlink.
- Nobody has viewed the new dashboard pages in a browser; there is no admin
  password in the build environment.
