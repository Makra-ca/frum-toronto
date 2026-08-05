---
name: category-required-admins-exempt
description: A primary category is mandatory on public submission; admins may exceed a listing's plan category limit
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** Two rules about categories, pulling in opposite directions on
purpose.

1. **A primary category is required** on public submission — enforced in
   `/dashboard/business/new` for the message and again in
   `POST /api/businesses/create` for the guarantee. The "No category" option is
   gone from the public form.
2. **Admins are exempt from the plan's category limit** when editing. The public
   form and create route enforce `max_categories` (Free 1, Standard 3, Premium 5,
   Elite 100); the admin routes do not.

**Context:** Every browse path selects on category, so a listing with none
appears on **no** page in the directory however complete the rest of it is.
Business #1635 (AristaAir) arrived with `category_id = NULL` and was, at the
time of this decision, the only such row — 0 approved listings have a null
category — meaning approving it as-is would have made it uniquely invisible.

**Chose over:**

- *Leaving category optional and having admins triage.* Rejected: it puts
  recurring manual work on Rochel to fix something the submitter knows the
  answer to, and a missed one is silently invisible rather than visibly broken.
- *Enforcing the plan limit for admins too.* Rejected: an admin is usually
  completing or correcting a listing **on the owner's behalf**, and a hard limit
  would block exactly that repair. The plan still governs what the public page
  displays, so the limit is not load-bearing for revenue at the admin's desk.

**Consequences:**

- The admin form keeps its "No category" option — 1,635 existing listings
  predate the requirement and must remain editable. The rule binds new public
  submissions only.
- An admin can put a Free listing in five categories. That is intentional, and it
  means `additional_category_ids` is not a reliable proxy for what a business
  paid for — read the plan for that.
- AristaAir (#1635) still has no category and is still pending. Left for Rochel
  deliberately: which category a business belongs in is a content decision, not
  a migration.

Related: [[one-predicate-for-category-membership]],
[[forms-collect-what-the-directory-needs]]
