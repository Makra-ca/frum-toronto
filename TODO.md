# TODO

## Contact Form (`/contact`) - DONE
- API endpoint created at `/api/contact`
- Form submissions saved to `contactSubmissions` table
- Admin can view messages at `/admin/contacts`

**Optional:** Set up email notifications when new contact form is submitted.

## Database Migration Needed
Run `npx drizzle-kit push` to add the `category` column to `contact_submissions` table.

## Businesses can claim and manage their own listing — NOT STARTED

1,633 listings, none with an owner; no owner-facing edit route exists; zero
subscriptions ever sold. The paid directory is built and never launched.

Designed to roughly 60% and parked on 2026-07-31, with the decisions already
made (hand-approved claims, two owner roles, old version stays live while an
edit waits).

**Full write-up: `docs/project-memory/TODO-business-claim-flow.md`**
