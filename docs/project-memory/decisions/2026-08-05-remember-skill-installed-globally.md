---
name: remember-skill-installed-globally
description: The decision-capture skill moves from makra-crm to ~/.claude/skills so every repo inherits it
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** The `remember` skill is installed at
`~/.claude/skills/remember/SKILL.md`, making decision capture available in every
repo rather than only `makra-crm`.

**Context:** This repo's `decisions/INDEX.md` already pointed at
*"`.claude/skills/remember` in makra-crm"* for the format — a convention shared
across repos with the tooling living in only one of them. The records here were
being hand-written to match, which works until a detail drifts. It did: one
record carried `status: partially-superseded`, which is not in the skill's
vocabulary of `accepted | superseded | reversed`.

**Chose over** copying it into each repo's `.claude/skills/`. Rejected because
three identical copies already existed in the makra-crm worktrees and a fourth
would be one more thing to keep in step.

**Consequences:** One edit at promotion time — the skill ended by pointing at a
makra-crm file that does not exist elsewhere. That is now generic, with a note
that records go in the *current* repo's `docs/project-memory/decisions/` and to
create the folder if a repo has none.

The assumption travels with the skill: it presumes that folder path. Safe here
because both repos already use it; a repo that does not will need the folder
created, which the skill now says.
