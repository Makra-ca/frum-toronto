---
name: deleting-a-user-asks-about-their-content
description: User deletion is a dry run first, then an explicit choice between keeping their posts on the Archive account or removing everything
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** `DELETE /api/admin/users/[id]` has three behaviours, selected by
`?mode=`:

| Mode | Behaviour |
|---|---|
| *(none)* | **Dry run.** Counts what the account owns. Writes nothing. 200 if clean, **409 with the inventory** if not. |
| `reassign` | Blog posts and comments move to the **Archive account** (3159); every other owner reference is set NULL; then delete. |
| `purge` | The account's content is deleted, then the account. |

**Context:** Users could not be deleted at all — the route exported `PATCH`
only. The one available action was the Active toggle, which blocks sign-in but
leaves the row in a list 3,200 rows long, most of it bot signups.

A plain `DELETE` would not have worked either. Measured on 2026-08-06, 31
foreign keys reference `users.id`:

- **19 NO ACTION** — the delete *fails*. The database refusing to orphan
  content is why a naive delete button would just error on any real member.
- **8 CASCADE**, **4 SET NULL** — the rest.

Two columns force the design: `blog_posts.author_id` and
`blog_comments.author_id` are **NOT NULL**, so their rows cannot be orphaned —
they must be moved or destroyed. There is no third option.

**Chose over:**

- *A single confirm-and-delete.* Cannot work: it fails on any member with a
  post, and the admin sees an unexplained error.
- *Always purge.* Silently destroys community content because an account was
  tidied away.
- *Always reassign.* Fills the Archive account with genuine spam.
- *Soft delete (a `deleted_at` column).* The problem being solved is a list too
  long to work with; a soft delete leaves every row exactly where it was.

**Consequences:**

- **`ask_the_rabbi_comments.author_id` is NOT NULL *and* CASCADE.** The database
  destroys those comments in **every** mode, before any of our code runs, with
  no foreign-key error to stop it. The dialog therefore warns about them
  unconditionally — there is no option that preserves them, and discovering that
  afterwards would be worse than being told.
- **No transaction** — `neon-http` has none. Reassign-then-delete is two round
  trips, and the order is chosen for the half-failure: content lands safely on
  the Archive account and the user still exists. Visible and recoverable, unlike
  the reverse.
- **Refusals are blanket for admins**, not last-admin-aware. Unlike a demotion,
  which a second admin makes safe, deletion cannot be undone by promoting
  someone afterwards. Demote first, then delete — two deliberate steps for an
  irreversible act. Also refused: the caller's own account, and the Archive
  account itself.
- **Every path is audited, refusals included.** "Who tried to delete whom" is
  worth as much as "who did". The inventory is captured *before* the delete,
  because afterwards there is nothing left to count.
- Bulk deletion issues **one request per account**, so each gets its own guard
  check and its own audit row, and one failure cannot silently take the others
  with it.
- The table map lives in `user-deletion-tables.ts`, which **must never import
  `@/lib/db`** — that module throws without `DATABASE_URL` and the vitest `unit`
  project runs without one.

Related: [[last-admin-guard-is-about-outcome]], [[unverified-is-not-a-proxy-for-bot]]
