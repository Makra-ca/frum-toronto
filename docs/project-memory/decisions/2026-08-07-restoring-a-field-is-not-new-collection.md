---
name: restoring-a-field-is-not-new-collection
description: Re-importing a field members gave the old FrumToronto is continuity, not a new collection requiring fresh consent
type: decision
date: 2026-08-07
status: accepted
originSessionId: 415c321c-22e2-44e7-9590-782e530aa276
---

**Decision:** Importing `MemberList.ShulAffiliation` back onto members' accounts is a **restoration**,
not a new collection. It does not require fresh consent, a privacy-policy gate before shipping, or
special handling beyond what any other imported profile field gets.

**Context:** The assistant argued the opposite — that 2,323 people gave their shul to a mailing list
around 2010, never agreed to it appearing on a rebuilt site, and that a `/privacy` page was a
prerequisite. Daniel corrected it: FrumToronto is the same organisation and the same site being
rebuilt. Members put the shul on their previous account here; putting it back is finishing the
migration, not repurposing anything.

**The test that settles it:** the identical argument would have blocked importing members' names,
phone numbers and email addresses — which happened in July 2026 without anyone treating it as a
consent problem, because it was obviously the same site being restored. Shul affiliation is not
different in kind. The assistant singled it out because "religious affiliation" reads as weighty in
the abstract, and evaluated the *field* rather than the *situation*.

Sensitivity is a property of the situation, not the column name. The same data genuinely would need
fresh consent if the list had been acquired from elsewhere, or were being exposed to shul staff, or
used for a purpose members did not come here for. None of those apply.

**Chose over:**
- *Requiring a `/privacy` route before the member field ships* — the policy is worth writing (it
  currently has no URL and cannot be linked from anywhere), but it is not a gate on restoring a
  field members already gave this site.
- *Importing as an admin-only note rather than onto the profile* — hides from members their own
  answer, which they can edit.

**Consequences:**
- The member field proceeds without a consent workstream. Two cheap things are kept because they
  improve it, not because they gate it: one line of copy on the form explaining why it is asked, and
  a light "you told us this in 2010 — still right?" confirm on imported values.
- Members can edit or clear it at any time. That correction path is what makes holding it
  reasonable, and it must exist before the import lands.
- [[shul-affiliation-is-private]] still stands on **visibility** — member and admins only. What is
  withdrawn is that record's framing of consent as un-back-datable and the privacy page as a
  prerequisite.
- Anything that genuinely *is* a new purpose — shul managers seeing their membership, public counts,
  segmenting a newsletter by shul — is a fresh decision, not covered by this one.

Related: [[shul-affiliation-is-private]], [[legacy-shul-affiliation-is-imported-not-discarded]]
