---
name: security-findings-written-up-not-fixed
description: The 24 findings from the API sweep are documented with evidence and left unfixed, pending Daniel's prioritisation
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** The security sweep's findings are written up in
`docs/project-memory/SECURITY-FINDINGS-2026-08-04.md` and **not fixed**. Only the
privilege escalation that started the investigation was fixed and deployed.

**Context:** Verifying one false claim in a spec surfaced a live privilege
escalation. A sweep of all 198 API routes then produced 24 more findings,
including four live ones — cron endpoints reachable anonymously, self-assignable
$120/mo plans, specials postable under any business's name, and a blog edit that
corrupts another user's post URL.

**Chose over** fixing the top four immediately, which was the recommendation.
Daniel chose the write-up so he could see the whole picture before spending time.

**Consequences:** Each finding records **how it was verified** — by me, by an
agent probe against production, or from code — so they can be weighed
individually rather than taken on faith. The document also lists what was checked
and found **clean**, so coverage is auditable rather than assumed.

The most urgent remains unfixed and is **anonymous**: `CRON_SECRET` does not
exist, two guards fail open and two require the literal header
`Bearer undefined`. The same cause means `cleanup-notifications` and
`notification-digest` have been returning 401 to Vercel's own scheduler since
they were written — **the daily digest has never run.**
