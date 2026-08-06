---
name: one-session-builds-one-reviews
description: With two sessions on one repo, one builds and commits while the other only reviews and reports
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** When two Claude sessions work the same repository, **one builds and
commits; the other reviews and commits nothing.** Findings route through Daniel,
not agent to agent.

**Context:** Both sessions independently specced and built the same three
features. One wrote four revisions of a 1,037-line spec for admin moderation
gaps while the other shipped all three parts of it. Roughly 3,800 lines of
duplicated effort.

**Chose over:**

- *Splitting by feature area.* Breaks down the moment either session touches
  shared code — `auth.ts`, `setApprovalStatus`, `UserTable` all sit on every
  boundary.
- *Closing one session.* Simplest, and it discards the second perspective —
  which immediately caught a destructive bug that 1,262 passing tests walked
  straight past.

**Consequences:**

- The reviewer's value is demonstrated, not assumed. Their first report:
  **one confirmed bug** (purge deleting records the user had only *acted on*),
  **one refuted claim** (a missing `broadcast_at` that was actually the
  single-writer pattern working), and **one new finding surfaced by chasing the
  refuted one**.
- **Findings must be verified before acting.** Both claims arrived equally
  confident and one was wrong; acting on both would have "fixed" a working
  design. A reviewer who states what they *verified* versus what they *inferred*
  is far more useful than one who does not.
- The reviewer retracting their own overstated claim — with the specific reason
  — is what made the rest of the report trustworthy. Worth asking for
  explicitly.
- The builder still self-reviews before committing. Green tests are not a
  review: every one of four findings in the Approvals editor passed the full
  suite.

Related: [[content-is-not-attribution]], [[admin-ui-is-tested-on-the-test-branch]]
