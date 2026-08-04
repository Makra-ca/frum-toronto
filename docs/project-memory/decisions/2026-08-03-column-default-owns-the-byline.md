---
name: column-default-owns-the-byline
description: The API omits answeredBy rather than substituting a fallback, because the column default was already correct
type: decision
date: 2026-08-03
status: accepted
---

**Decision:** `quick-post` omits `answeredBy` from the insert when the form
sends nothing, letting the `answered_by` column default apply. The fallback
chain is **deleted**, not redirected. The composer gained an "Answered By" field
defaulted to the Rav, matching the answer-a-submission dialog that always had one.

**Context:** The route read:

```ts
const resolvedAnsweredBy =
  answeredBy || [session.user.name].filter(Boolean).join("") || "FrumToronto Rabbi";
```

That reads as careful defensive coding. Every arm of it defeats a database
default — `answered_by` already defaults to `"Hagaon Rav Shlomo Miller Shlit'a"` —
and because the form had no field, the session-name arm was the *normal* path,
not the exception. Live result: 5,511 Q&As correctly credited, 9 reading
"Admin User", 1 reading "Rabbi Bartfeld", all public.

**Chose over:** changing the fallback to the Rav's name. That leaves the same
bug for any future caller that omits the field, and the regression test — absent
`answeredBy` yields the Rav — only passes if the chain is actually removed.

**Consequences:** Nine rows backfilled in production; all reversible, every one
held exactly `"Admin User"`. The tenth wrong byline was question #8204, *"THis
is a test for Ask the rabbi"* — deliberately **not** backfilled, since crediting
a test post to the Rav is worse than leaving it. Deleted instead, with the full
row written to `scripts/atr/deleted-question-5519.json` because this document's
predecessor described the delete as reversible from the spec and it was not.

**General rule this stands for:** suspect a fallback chain whenever the column
beneath it already has a sensible default. The code and the schema are then
disagreeing about who owns the decision.
