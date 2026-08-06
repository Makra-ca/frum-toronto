---
name: blog-comments-stay-open
description: Blog comments publish immediately; moderation exists and is deliberately switched off
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Blog comments go live immediately. The `blog_comment_moderation`
site setting is **deliberately absent**, so every comment falls through the
cascade to the default.

**This is a choice, not an oversight.** A future session finding a full
moderation system with nothing enabled should not "fix" it.

**Context:** The cascade is: admin → live · post-level `commentModeration`
override → live/held · site-wide setting → live/held. Measured 2026-08-06: the
setting row does not exist, **zero** posts carry an override, and there is
**one** comment on the entire site.

**Chose over:**

- *Site-wide moderation.* Safest against abuse, and a queue with nothing in it
  is work for Rochel plus a worse experience for the commenter, whose comment
  sits invisible for days and reads as silently dropped.
- *Per-post overrides.* Requires predicting which article will attract argument.
  In practice it gets set after the problem, not before.

**Consequences:**

- Two real barriers already stand in front of commenting: a **verified email**
  and a **non-blocked account** (`assertCanPost`), and since 2026-08-06
  registration is behind Cloudflare Turnstile. A spammer needs a working inbox
  and a passed captcha before they can post anything.
- The reactive control is per-user: `commentPermission = 'blocked'` in
  Admin → Users silences an individual without affecting anyone else.
- Turning moderation on later is one row in `site_settings`; the queue at
  `/admin/programs/blog/comments` already exists and works.
- Related, fixed the same day: authors could previously set `commentModeration`
  on their own post, and since the post-level value **overrides** the site-wide
  one, any author could switch off moderation an admin had enabled for the whole
  site. Now admin-only.

Related: [[turnstile-without-a-rate-limit]]
