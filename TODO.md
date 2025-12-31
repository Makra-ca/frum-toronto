# TODO

## Contact Form (`/contact`) - DONE
- API endpoint created at `/api/contact`
- Form submissions saved to `contactSubmissions` table
- Admin can view messages at `/admin/contacts`

**Optional:** Set up email notifications when new contact form is submitted.

## Database Migration Needed
Run `npx drizzle-kit push` to add the `category` column to `contact_submissions` table.
