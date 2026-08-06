---
name: newsletter-links-are-signed-not-allowlisted
description: Click-tracking destinations carry an HMAC minted at send time rather than being checked against a host list
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** `/api/newsletter/track/click` follows a destination only when it
carries a valid HMAC signature, minted at send time by
`wrapLinksWithTracking` using `NEXTAUTH_SECRET`
(`src/lib/newsletter/click-signature.ts`).

**Context:** The endpoint took the destination from the query string, checked
only that `new URL()` could parse it, and redirected — an open redirect on a
domain a mailing list is trained to trust. `new URL()` validates syntax, not
destination.

The exposure is worse than the generic case: the visible host, the hover preview
and a corporate link scanner all see frumtoronto.com, so the redirect defeats
every check a careful reader can actually perform.

**Chose over:**

- *A host allowlist.* This is the obvious fix and it does not fit. Newsletters
  link legitimately to arbitrary business websites, so there is no list to write
  — an allowlist would either be maintained by hand forever or be so broad it
  stops meaning anything.
- *Same-origin only.* Would break the newsletter's actual purpose.
- *Storing permitted destinations per send.* Correct but heavier: a table, a
  write per link, and a lookup on every click, to answer a question a signature
  answers with no I/O at all.

**Consequences:**

- Signing depends on `NEXTAUTH_SECRET`, which is already required for the app to
  boot — so there is no state where signing silently degrades. Minting throws
  without it, verification returns false.
- Rotating `NEXTAUTH_SECRET` invalidates links in already-sent newsletters. That
  is acceptable and worth knowing: rotation also invalidates every session, so it
  is not a routine operation.
- **Zero migration cost, verified:** production has 0 rows in
  `newsletter_sends` and 0 in `newsletter_recipient_logs`. No newsletter has ever
  been sent, so no unsigned link exists in anyone's inbox. Had that not been
  true, unsigned links would have needed a grace period.
- A second `decodeURIComponent` was removed at the same time. `URLSearchParams`
  has already decoded once, so decoding again corrupted any destination
  containing a literal percent — and the value has to match, byte for byte, what
  the signature covers.

Related: [[create-and-edit-schemas-must-agree]]
