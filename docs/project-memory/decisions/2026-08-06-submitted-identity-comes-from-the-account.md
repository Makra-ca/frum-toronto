---
name: submitted-identity-comes-from-the-account
description: A logged-in submitter's displayed name and reply address are read from their account row, not accepted from the form
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Where a submission is made by a logged-in user, the name shown to
the reviewer and the address a reply is sent to are read from the account row.
They are not accepted from the request body, and the form's fields are rendered
read-only.

Applied first to `POST /api/ask-the-rabbi/submit`.

**Context:** That route took `name` and `email` from the body. `userId` was
session-derived and correct, so this was never an authentication hole — but the
identity *shown* to the rabbi in the admin queue and the `replyTo` his answer is
addressed to were both whatever the sender typed. A question could arrive signed
"Rabbi Bratefeld" with the reply routed to an address of the sender's choosing.

The form already prefilled both from the session, so for every honest submission
this changes nothing. It was an editable field nobody had a reason to edit.

**Chose over:**

- *Validating that the email belongs to the user.* Equivalent outcome, more code,
  and it still leaves a field on screen whose only correct value is the one
  already in it.
- *Leaving it, on the grounds that a shared family account might want a different
  reply address.* Plausible, and not worth the exposure. If it ever comes up, the
  answer is a verified alternate address on the account, not a free-text box on
  the form.

**Consequences:**

- The modal's Name and Email inputs are `readOnly disabled`, with a line saying
  the answer goes to that address and to change it, change your account. **An
  editable field the server ignores is a lie** — that is the part worth carrying
  to other forms.
- Client-side validation of those two fields was removed with them; the fields
  cannot be blank because they come from a row that has already been proved to
  exist and be active by `assertCanPost`.
- Other submission forms that still take a contact name or email from the body
  (classified contact's `senderName`, for one) have the same shape and are not
  yet changed.

Related: [[create-and-edit-schemas-must-agree]]
