---
name: turnstile-without-a-rate-limit
description: Registration gets Cloudflare Turnstile and no per-IP rate limit; revisit only if bots keep arriving
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Registration is protected by Cloudflare Turnstile alone. No per-IP
signup cap, no new rate-limiting utility, no new storage.

**Context:** `POST /api/auth/register` had no captcha, no honeypot and no rate
limit — grepped for all three, zero hits — and was taking 10–15 bot signups a
day. Keyboard-mash names (`Sule Nqpowhiuo`, `Tafbu Tnbmkh`) on scraped business
addresses. The design spec proposed Turnstile *plus* a rate limit, on the
grounds that tokens can be farmed.

**Chose over:**

- *A `signup_attempts` Postgres table.* No new service or credentials, and the
  load would be nothing — but it puts a write on an unauthenticated endpoint,
  which is precisely what an attacker is hammering. Solving a spam problem by
  giving the spammer a write is the wrong direction.
- *Upstash Redis.* Genuinely the right tool — atomic counters, automatic expiry,
  no load on the primary database — and it costs an account, two env vars and a
  free tier with limits, to defend against an attacker this traffic does not
  have.

Token farming is a real technique and not what is happening here. The signups
are unsophisticated, and Turnstile is very likely enough on its own.

**Consequences:**

- If bot signups continue after this ships, that is the signal to add a limit,
  and Upstash is the answer at that point — the shape of the problem will have
  changed.
- **The contact form is deliberately excluded.** 14 submissions in its entire
  history, roughly one a day, all from real people. A challenge on a form real
  community members use, to block spam that is not occurring, is a bad trade.
- Missing-key behaviour is asymmetric on purpose: **closed in production, open
  everywhere else.** A silent pass in production would mean the protection is
  off with nothing saying so, while the page still rendered a widget implying it
  works. A hard failure in development would block local work and every existing
  test that posts to the register route, for no security benefit.
- Verification runs **before the schema check and before any database read**.
  After the existing-user lookup, the endpoint would be an address oracle over
  3,200 members: post an email, and "an account with this email already exists"
  answers the question with no token at all. `tests/turnstile-registration.test.ts`
  pins the ordering.

Related: [[create-and-edit-schemas-must-agree]]
