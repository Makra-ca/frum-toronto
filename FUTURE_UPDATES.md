# Future Updates

This file tracks planned features and improvements for future implementation.

---

## Tehillim Expiration Email Notifications

**Priority:** Medium
**Added:** 2026-02-22

### Description
Send email reminders to users before their Tehillim entries expire, giving them the option to renew.

### Requirements
- Send email 3 days before expiration
- Include link to renew/extend the entry
- Include option to remove from list early
- Track whether reminder was sent (add `reminderSentAt` field to schema)

### Implementation Notes
1. Add `reminderSentAt` timestamp field to `tehillim_list` table
2. Create cron job that runs daily to check for entries expiring in 3 days
3. Send email to user with renewal link
4. Update cron to skip entries where reminder was already sent

### Email Content
```
Subject: Your Tehillim entry for [Name] expires in 3 days

Your prayer request for [Hebrew Name / English Name] will be removed from
the Tehillim list in 3 days.

If you would like to extend the duration, click here: [Renew Link]

If the person has recovered or you no longer need the entry, no action is needed
and it will be automatically removed.
```

---

## Other Planned Features

(Add additional planned features here as they come up)
