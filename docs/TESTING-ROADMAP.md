# FrumToronto — Testing Roadmap

**Last updated:** 2026-06-07
**Test environment:** Production — https://www.frumtoronto.com (a.k.a. frum-toronto.vercel.app)
**Source:** April 2026 PM feature requests + the admin-notification project.

## How to use this

- Tick each box as you confirm it works on the **live site**.
- Items are grouped by area. Each has the **page/URL**, the **action**, and the **expected result**.
- Anything not yet built (or only partially) is in **§13 Known Gaps** at the bottom — don't test those as "broken"; they're scoped-out / future work.
- Some tests need two roles: an **admin** login and a **regular member** login (use an incognito window for the member, or a second test account).

### Before you start (pre-flight)
- [ ] Latest deploy is **Ready** in Vercel (the modal-fix + notification commits).
- [ ] You can log in as **admin** (`admin@frumtoronto.com`).
- [ ] You have a **non-admin** test account (for "regular user submits → goes pending" tests).
- [ ] Open **resend.com → Logs** in a tab (to confirm emails actually send).
- [ ] Know where admin emails go: **all 12 form types → `Daniel@makra.ca`** (changeable at `/admin/settings`).

---

## §1 — Admin Notifications (the new system) ⭐ highest priority

**Tiers:** A = instant email + bell · B = bell + daily digest · C = bell FYI only.

### Instant-email submissions (Tier A)
- [ ] **Contact form** → submit at `/contact` (no login needed) → email to Daniel@makra.ca within ~30s + bell increments.
- [ ] **Ask the Rabbi question** → submit at `/ask-the-rabbi` → email + bell.
- [ ] **New business** → register a business → email + bell.
- [ ] **Shul management request** → request to manage a shul → email + bell.
- [ ] **Shiva notice** (as non-trusted user) → submit → email + bell.
- [ ] **Kosher alert** (as non-trusted user) → submit → email + bell.
- [ ] **Non-profit application** → submit business non-profit docs → email + bell.
- [ ] **Newsletter shoutout** (Elite business) → submit → email + bell.

### Bell-only submissions (Tier B — no instant email, shows in daily digest)
- [ ] **Event** (as non-trusted user) → submit → bell increments, **no email**.
- [ ] **Simcha** → submit → bell, no email.
- [ ] **Classified** → submit → bell, no email.
- [ ] **Blog post** → submit → bell, no email.
- [ ] **Blog comment** → post on a blog → bell, no email.
- [ ] **Ask the Rabbi comment** → comment on a Q&A → bell, no email.
- [ ] **Special/deal** → submit → bell, no email.
- [ ] **Community alert** → submit → bell, no email.

### FYI-only (Tier C — content went live without review)
- [ ] **Trusted user auto-approved content** (e.g. a user with auto-approve permission submits an event) → bell shows FYI, **no email**, and the content is live immediately.
- [ ] **Shul manager edits** a shul / davening / uploads a document → bell FYI.

### Where the admin acts on them
- [ ] Click the **🔔 bell** (top-right of admin) → see the list → each notification **deep-links to the correct review page**.
- [ ] Approvals queue (`/admin/approvals`) shows pending **simchas, classifieds, tehillim**.
- [ ] Other pending types are in their own sections (Businesses, Programs, Community, Shuls→Requests) — the bell links you there.

---

## §2 — Real-time bell (Pusher)
- [ ] Browser A: logged in as admin on the admin panel. Browser B (incognito): submit a contact form.
- [ ] **Expected:** bell count in Browser A **increases without refreshing**.
- [ ] Confirm the page is **not** constantly hitting the DB (Pusher replaced polling) — optional: Network tab shows no repeated `/unread-count` calls every 60s.

---

## §3 — Daily digest email
- [ ] Runs automatically **8 AM EST**; only sends if something is pending.
- [ ] With pending Tier-B items present, the digest email to Daniel@makra.ca lists counts per type ("3 classifieds, 2 blog comments…") with links.
- [ ] With nothing pending → no email is sent.
- [ ] *(Optional — to test on demand instead of waiting: ask Claude to trigger the cron route with the CRON_SECRET.)*

---

## §4 — Approval gating (security: unapproved content stays hidden)
For each: submit as a **regular user** so it's "pending", then check it's hidden publicly, then approve and confirm it appears.
- [ ] **Classified** — pending one is **404 / hidden** at its public URL while logged out; appears after approval.
- [ ] **Business** — pending business hidden at `/directory/business/[slug]` publicly; **owner/admin can still preview it** (with a "Pending approval" banner); appears publicly after approval.
- [ ] **Ask the Rabbi** — unpublished question hidden at `/ask-the-rabbi/[id]` publicly; **admin/ATR-manager can preview**; appears once published.
- [ ] **Directory category** — pending business does **not** appear in the category browse list.
- [ ] **Shiurim** — only approved shiurim show in the list and detail.

---

## §5 — UI fixes from this session
- [ ] **Homepage node network** orbits **smoothly** (no jitter), nodes visible, no disappearing.
- [ ] **Hero background** — the blurry blue glow blobs are gone (clean gradient).
- [ ] **Modals fit the screen** — open admin → Users → **Manage** on a user: the permissions dialog stays within the viewport and **scrolls internally**; Save/Cancel always reachable. Spot-check a couple of other admin dialogs (e.g. add category, edit plan) on a short laptop screen.
- [ ] **Comment delete** — a user can delete their own blog/ATR comment; an admin/ATR-manager can delete any (replies cascade).

---

## §6 — Events
- [ ] **Flyer + image upload** on event submit (`/community/calendar/new`).
- [ ] **Website URL** field saves (shows in event broadcast email).
- [ ] **Auto-fill from previous event** — second event submit shows a dropdown to copy a past event.
- [ ] **Conflict detection** — submit an event on a date that already has one → conflict modal appears; "Schedule Anyway" proceeds; the other organizer gets a conflict email.
- [ ] **Broadcast email** — approved event emails subscribers who opted into community events.
- [ ] **Event type filter** on `/community/calendar` works.
- [ ] **Homepage upcoming events** show in a responsive grid.
- [ ] **Shul events** appear in the main calendar (with shul name badge).
- [ ] **Events block** can be toggled into a newsletter.

---

## §7 — Ask the Rabbi
- [ ] **Comments** on a published Q&A (post, reply 1 level, see pending/approved behavior).
- [ ] **Standalone nav** item "Ask The Rabbi" (not under Community).
- [ ] **Submitter notified when answered** — submit a question, answer it as admin/manager → submitter gets in-app notification (+ email if opted in).
- [ ] **Manager permissions** — a user with `canManageAskTheRabbi` can access `/dashboard/ask-the-rabbi`, quick-post, answer, moderate.
- [ ] **ATR in newsletter** — Q&A block renders in the newsletter.

---

## §8 — Blog
- [ ] **Create** a blog post (`/dashboard/blog/new`) with **cover image cropping** (16:9 with vertical position slider).
- [ ] **Edit** a pending/rejected post (`/dashboard/blog` → Edit) — saves correctly.
- [ ] **Public blog** — listing with category filter + pagination (`/blog`), detail page, view count, comments.

---

## §9 — Businesses & Advertising
- [ ] **Homepage ads** — banner + sidebar ads link to the business **website** (or detail page if no website), open in new tab.
- [ ] **Business video** — Elite business uploads video → admin approves at `/admin/businesses/video-review` → video plays on the business page.
- [ ] **Traffic analytics** — visit some business pages → `/admin/analytics` shows page views, top businesses, trends, date-range selector.
- [ ] **Non-profit application** — submit docs → admin approves at `/admin/businesses/non-profit` → non-profit pricing applies.
- [ ] **Newsletter shoutout** — Elite business books a future date (blocked on Shabbat/holiday + once-per-year) → admin approves → appears in that day's newsletter.
- [ ] **Restaurant dining type** — a restaurant business shows a meat/dairy/pareve color badge on its page. *(Note: no filter for it in directory search yet — see §13.)*
- [ ] **Subscription / PayPal** — pick a plan + billing cycle → PayPal flow → subscription recorded → plan's banner/sidebar placement takes effect.

---

## §10 — Classifieds
- [ ] **2,000-char description limit** with live counter on `/classifieds/new`.
- [ ] **Anonymous email relay** — "Contact Seller" sends a relayed email (seller's real address not exposed to sender; reply goes back via reply-to).

---

## §11 — Newsletter
- [ ] **Content blocks** — toggle Ask the Rabbi, Tehillim, Blogs, Events, Simchas, Omer, Business Shoutout in the composer; classifieds intentionally **excluded**.
- [ ] **Batch send** to subscribers (batches of 100 via Resend).
- [ ] **Open/click tracking** — after a send, open counts + click counts update.

---

## §12 — Shuls / Eruv / Search / Zmanim / Navbar
- [ ] **Davening schedule** on a shul detail page (by prayer type, day, season, time).
- [ ] **Shul documents** — Newsletters + Tefillos PDF sections on the shul page.
- [ ] **Eruv** — red/green status on homepage widget; admin can toggle up/down at `/admin/community/eruv`.
- [ ] **Universal search** — search box returns fuzzy suggestions across types with type badges.
- [ ] **Zmanim** — date picker + week/month navigation + "Today" on `/zmanim`.
- [ ] **Navbar** — on a 14" laptop (~1366px) the nav doesn't overflow; hamburger on smaller screens.

---

## §13 — Known gaps (do NOT test as bugs; report to PM as future work)

| Feature (from April notes) | Status | Note |
|---|---|---|
| Events: filter/list **by organization** on the calendar | **Partial** | Organization is captured (autocomplete) but there's no "filter by org" control or org display on the calendar. |
| Blog: **featured blogs on the homepage** | **Partial** | "Write a Post" CTA exists on `/blog`, but no featured-blogs section on the homepage. |
| Newsletter: **dedicated business ad block** | **Partial** | Paid "Business Shoutout" exists; a separate banner/sidebar ad block inside the newsletter is not wired in. |
| Business onboarding: **single ad vs daily vs weekly digest** toggle | **Not built** | Only a single on/off "business deals" preference exists — no frequency choice. |
| Directory: **filter** restaurants by meat/dairy/pareve | **Partial** | The dining-type badge shows on business pages, but there's no dining-type filter in directory search yet. |
| Submitter notifications beyond Ask the Rabbi (e.g. "your event was approved") | **Not built** | Only ATR notifies the submitter on answer. General submitter-side notifications are a planned follow-up project. |

---

## Reference: how to change where admin emails go
`/admin/settings` → form recipients section → add/edit/remove per form type. Currently every type → `Daniel@makra.ca`. No deploy needed; changes are immediate.
