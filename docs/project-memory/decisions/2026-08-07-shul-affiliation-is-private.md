---
name: shul-affiliation-is-private
description: A member's shul affiliation is visible only to that member and to admins — not publicly, and not to their shul's managers
type: decision
date: 2026-08-07
status: accepted
originSessionId: 415c321c-22e2-44e7-9590-782e530aa276
---

**Decision:** Shul affiliation is visible to the member and to admins. It does not appear on
public profiles, shul managers cannot see who has affiliated with their shul, and shul pages
show no membership counts.

**Context:** 2,323 of these values come from the legacy `MemberList` table — people who gave
their shul to a **mailing list around 2010**. They agreed to receive email, not to appear on a
roster. New signups are answering the same question in the same spirit.

**Chose over:**
- *Visible to that shul's managers* — genuinely useful for a shul, and the most tempting
  option, but nobody consented to their name being shown to their shul's staff. Consent
  cannot be back-dated onto imported data.
- *Public aggregate counts* — "143 members daven here" reads harmlessly, but in a community
  this size a count of 1 or 2 identifies a person.
- *Fully public* — only defensible if this were a community directory people opted into.

**Consequences:**
- Opening this up later is easy; closing it after exposure is not. That asymmetry is the
  whole argument.
- If shul managers ever want membership lists, it needs member opt-in, and the imported
  cohort must be asked rather than assumed.
- Any future feature that surfaces "who is at this shul" has to revisit this record first.

Related: [[typed-shuls-are-suggestions-not-shuls]], [[legacy-shul-affiliation-is-imported-not-discarded]]
