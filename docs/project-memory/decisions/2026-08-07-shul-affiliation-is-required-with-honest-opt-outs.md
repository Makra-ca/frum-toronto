---
name: shul-affiliation-is-required-with-honest-opt-outs
description: Signup requires an answer about shul affiliation, with "I don't have a shul right now" and "Prefer not to say" as real choices — no generic "Other"
type: decision
date: 2026-08-07
status: accepted
originSessionId: 415c321c-22e2-44e7-9590-782e530aa276
---

**Decision:** The shul question is required at signup. The choices are: pick a shul from the
directory; *my shul isn't listed* (type it); *I don't have a shul right now*; *Prefer not to
say*. One shul per member, changeable any time from dashboard settings.

**Context:** The old site asked optionally and still got 70% completion, so forcing it was not
needed for coverage — the reason to require it is that a required field with an honest opt-out
produces a **conscious answer**, where an optional field produces silence you cannot interpret.

**Chose over:**
- *A single "Other" option* — rejected because it merges three unrelated people: someone whose
  shul is missing from the directory (a directory gap to fill), someone who does not attend a
  shul (a person a shul might want to welcome), and someone unwilling to answer (a preference
  to respect). One bucket tells you nothing, and it would pollute the typed-shul suggestion
  queue with people who simply had nowhere else to click.
- *Optional* — cheaper on the form, but leaves "unset" and "declined" indistinguishable.
- *Dashboard only, not at signup* — shortest signup form, but almost nobody visits settings.
- *Multiple shuls per member* — realistic (a weekday minyan and a Shabbos shul), but the
  legacy data supplies exactly one, and one → many is a far easier migration than the reverse.

**Consequences:**
- `shul_status` must distinguish `listed | typed | none | private | unset`. `shul_id IS NULL`
  alone is ambiguous across four different facts, and the legacy import produces all of them
  at once — imported members are `unset` until they answer, which is distinct from `private`.
- "I don't have a shul right now" is a usable signal in its own right, not a null.
- Making it required means the signup form gains a blocking field; watch registration
  completion after launch.

Related: [[legacy-shul-affiliation-is-imported-not-discarded]], [[shul-affiliation-is-private]]
