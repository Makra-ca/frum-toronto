---
name: admin-ui-is-tested-on-the-test-branch
description: The admin panel is exercised in a browser against the Neon test branch, with a real admin password set there
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Admin work is verified by signing in and clicking through it, on the
**Neon test branch**, using two scripts:

- `scripts/sync-events-to-test.mjs` — copies production `events` onto the branch
  so the UI meets real data, not fixtures
- `scripts/set-test-admin-password.mjs` — sets a known admin password **on the
  test branch only**

Both refuse to run unless the target endpoint is the test branch.

**Context:** Every prior session recorded the same limitation — *"admin pages
could not be exercised in a browser (no admin password)"* — and that is exactly
how a missing Approve button survived months of work. The API routes were
correct and fully tested; nothing in the UI called them. Verification had always
asked *does this endpoint behave correctly*, never *can a human reach it*.

Setting a password is safe on a disposable branch and unacceptable in
production, which is why the guard is an assertion rather than a convention.

**Chose over:**

- *Component tests.* They would not have caught it: the bug was an absent
  button, and you cannot write a test for a component nobody wrote.
- *Testing against production with a real admin password.* One misdirected click
  approves a real event and emails the community.

**Consequences:**

- The first browser walkthrough immediately confirmed the whole Approvals path
  end to end: edit a pending event, save, status stays `pending`, card updates
  in place, approve, `broadcast_at` stamped, re-approve does not re-announce.
- **`.env` must be restored afterwards.** The run swaps `DATABASE_URL` to the
  branch; a failed restore leaves the next script or dev server pointed at test
  while believing it is production. It happened once during this session and was
  caught by re-reading the endpoint rather than assuming the copy had worked.
- Part 4 of the moderation spec — the full admin walkthrough — is now
  mechanically possible for any future session.

## The trap this uncovered

**Ad-hoc `neon()` scripts parse `timestamp without time zone` differently from
the app's Drizzle client.** For one event the raw script reported 23:45 and the
app reported 19:45 — the whole EDT offset — from the same column.

The naive value carries no offset, so the driver path decides. Drizzle reads it
as UTC; a bare `neon()` script reads it as server-local. The app is
self-consistent, and the diagnostics were not measuring the same thing.

**So: never report a timestamp from a throwaway script as though it were what
the app shows.** Read it through the app, or convert explicitly. The underlying
cause is the 82 `timestamp without time zone` columns already flagged in
CLAUDE.md as the PostgreSQL wiki's "Don't Do This".

Related: [[content-is-not-attribution]]
