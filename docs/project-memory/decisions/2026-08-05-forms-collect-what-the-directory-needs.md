---
name: forms-collect-what-the-directory-needs
description: A form collects any field the directory needs to browse or search; plan flags gate the rest
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** A business form collects every field **the directory itself needs
to function** — regardless of plan — and the `show_*` plan flags gate only the
fields whose sole consumer is the listing page.

Established by audit, not by taste. Grepping every read of every `businesses`
column across `src/lib/search/fuzzy-search.ts`, both directory browse pages and
both directory APIs splits the columns cleanly:

| Always collected | Why the platform needs it |
|---|---|
| `name` | trigram similarity + LIKE on every surface |
| `category_id` + `additional_category_ids` | decides which browse page the listing appears on at all |
| `description` | the **only** free-text search signal besides the name |
| `city` | the city filter and the facet that populates its dropdown |
| `is_kosher` + `kosher_certification` | the "Kosher only" filter, and the certification dropdown is built FROM this column |

| Plan-gated | Consumer |
|---|---|
| `email`, `website`, `hours`, `logo_url`, `social_links`, `contact_name`, `address`, `phone`, `postal_code`, `dining_type`, `tagline` | the listing page, and nothing else |

The second group was verified **negatively**: not one of those columns appears
in any `WHERE`, `ILIKE`, `groupBy` or facet query in the public directory or
search code. They are selected for rendering only.

**Context:** `/dashboard/business/new` reused the display flags to decide what
could be *typed*, so a Free submitter physically could not enter a description
or a category. Listings arrived as a name and a phone number — business #1635
(AristaAir) is the case that surfaced it — and the data was lost rather than
merely hidden. 1,634 of 1,635 listings are on Free, so this is nearly the whole
directory.

**Chose over two alternatives:**

- *Collect everything, hide by plan.* Rejected: it hands away what the tiers
  sell and invites an owner to fill in fields nobody will see — the objection
  already recorded in [[owner-editor-matches-the-tier]].
- *Keep tier boundary = form boundary* (the status quo). Rejected: it lets the
  paywall silently degrade **search and browse**, which are the product, not the
  listing's own presentation.

The line that resolved it is not "how valuable is this field" but **"who reads
it."** Search and browse are *platform* consumers — gating them costs every
visitor. A tier is entitled to sell what only that listing's own visitor sees.

**Consequences:**

- `description` is collected on every plan and displayed per plan, with a note:
  "Saved with your listing, but hidden from the public page until you upgrade."
- `email` is **not** collected on Free. An earlier version of this session's work
  ungated it; that was reverted once the audit showed nothing reads it. Admins
  reach a submitter through the **account** email now shown in the admin edit
  dialog — the business-level email was never what that workflow needed.
- Free-plan descriptions are hidden but **searchable**. Deliberate: no text
  leaks (search matches on the column, never returns it) and a findable listing
  is a better directory.
- This **narrows** [[owner-editor-matches-the-tier]] rather than reversing it.
  That record stays correct for email, website, hours, logo and social links.
- New fields must be classified on this axis before being added to a form.

Related: [[owner-editor-matches-the-tier]], [[kosher-is-never-plan-gated]],
[[category-required-admins-exempt]]
