---
name: create-and-edit-schemas-must-agree
description: A validation rule on a column is enforced on every write path, not only on create
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** When a column carries a validation rule that exists for safety —
a URL allowlist, an ownership check, a posting gate — that rule is enforced on
**every** write path for that column. The create schema and the edit schema for
one column have to agree, and a reviewer should treat a rule that appears in only
one of them as a bug rather than a style difference.

**Context:** Six separate findings in the 2026-08-04 security sweep were the same
defect wearing different clothes:

| Column | Enforced on create | Skipped on edit |
|---|---|---|
| `shiva_notifications.attachment_url` | upload-host allowlist | yes (fixed earlier) |
| `blog_posts.slug` | ownership | yes |
| `shul_documents.file_url` | upload-host allowlist | yes |
| eight mutating handlers | `assertCanPost` | yes |

Every one of the create routes carried a comment explaining precisely why the
rule mattered. The edit route, written later and usually in a different session,
carried nothing — so the reasoning never travelled, and the control was reduced
to a speed bump: upload a real PDF, then PATCH the row to a `data:` URL.

**Chose over:**

- *Sharing one schema between create and edit.* Tempting, and wrong in this
  codebase: edit schemas are `.partial()`, edits carry `pending_edit`, and some
  fields are legitimately create-only. Forcing one object would produce a schema
  full of conditionals, which is harder to audit than two that agree.
- *A lint rule.* Nothing mechanical distinguishes "this refine is a security
  control" from "this refine is a nicety".

So this is a review habit, not a mechanism — which is why it is written down
rather than automated.

**Consequences:**

- Adding a validated field means finding every write path for it before
  committing, not only the one being worked on.
- The `refine` and the comment explaining it are copied together. The comment is
  the part that survives into the next session.
- The pattern is recorded under "A shape worth naming" in
  `docs/project-memory/SECURITY-FINDINGS-2026-08-04.md` so a future sweep starts
  by grepping for it.

Related: [[single-writer-for-approval-status]] — the same instinct applied to a
status column, where the answer was a single writer rather than agreeing
schemas, because there the write itself could be centralised.
