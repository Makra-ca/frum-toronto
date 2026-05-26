# Feature Q&A — Final Changes Scope

Fill in answers under each question. Leave blank if unsure — we'll discuss live.

---

## EVENTS

**E1. Email subscribers about new events — when does it fire?**
Options:
- [ ] Every event creation (could spam)
- [ ] Only events admin marks "promote in newsletter"
- [ ] Only events from specific organizations
- [ ] Manual "Send announcement" button per event

Answer: Every event creation 

---

**E2. "Imported users" for event emails — where do they come from?**
Options:
- [ ] Event organizer pastes/uploads a CSV of emails
- [ ] Global "extra recipients" list managed by admin
- [ ] Pulled from emailSubscribers table only

Answer: Can you show me wexactly where i mentioned this


---

**E3. Conflict detection scope — what counts as a conflict?**
Options:
- [ ] Any two events on the same day (even across the city)
- [ ] Same day AND same event type
- [ ] Same day AND same organization
- [ ] Same day AND overlapping time window

Answer:Any two events on the same day (even across the city)

---

**E4. Who is the "organizer" of an existing event for conflict emails?**
Options:
- [ ] The userId who created the event
- [ ] The contactEmail field on the event
- [ ] Both

Answer: What conact email field on the event? That implies that there is a contact Email field on the event but that can be the public contact email and the email with their account is differnt

---

**E5. Auto-fill — which fields get auto-filled from the previous event?**
Suggestion: description, location, contactName, contactEmail, contactPhone, organization, eventType
(NOT startTime/endTime — those should always be blank)
Is that right, or different?

Answer: Thats right

---

**E6. Auto-fill — scope of which events to pull from?**
Options:
- [ ] Only events this user created
- [ ] Events from the same organization
- [ ] All events platform-wide

Answer: Only events this user created. QUestion though wouldn't it get messy though?

---

**E7. Flyer vs imageUrl — are these separate fields?**
Currently events have `imageUrl`. Is a "flyer" the same field (just renamed/repurposed)?
Or a separate `flyerUrl` so events can have both a cover image AND a downloadable flyer PDF?

Answer: what did teh PM say exactly to this what is the context

---

**E8. Shul events → main calendar — clarify the request**
Currently shul events are created in the `events` table with a `shulId`. They already
appear on the community calendar. What specifically is missing?
Options:
- [ ] Shul managers can't create events from their dashboard yet (build that UI)
- [ ] Shul events should be filterable on the main calendar (show by shul)
- [ ] Something else

Answer: What was the exact PM quote and context

---

**E9. Homepage events grid — confirm layout**
Proposed: 5 events in a 3-column grid (Row 1: 3 events, Row 2: 2 events + "View all" CTA)
Agree?

Answer:  Why don't we do 3 evens row 2: 3 events and cta a row 3

---

## ASK THE RABBI

**ATR1. Comments moderation — who approves?**
Options:
- [ ] Admin reviews all comments (pending queue like blog)
- [ ] Auto-approved for all logged-in users
- [ ] Auto-approved only for trusted users

Answer: So users who are not logged in, can't put commnets but users who are logged in can comment but there is option that a admin can flag certain users, (in future this might be the default), so that they're comments have to get approved first

---

**ATR2. Comments — threaded or flat?**
Options:
- [ ] Flat only (no reply threads)
- [ ] 1-level threading (reply to a comment, no deeper)
- [ ] Full threading (like Reddit)

Answer: I do like reddit style

---

**ATR3. Homepage orbit — replace or add?**
The orbit currently shows community feature nodes. PM said "ask the rabbi in orbit instead community."
Options:
- [ ] Replace the Community node with Ask the Rabbi node
- [ ] Add Ask the Rabbi as an additional orbit node
- [ ] Other

Answer: 
Replace the Community node with Ask the Rabbi node
---

**ATR4. Notification when answered — channel?**
Options:
- [ ] Email to submitter only
- [ ] In-app notification only
- [ ] Both

Answer: Both

---

**ATR5. canManageAskTheRabbi permission — what can they do?**
Options:
- [ ] Publish/answer questions directly (without being full admin)
- [ ] Reject/moderate submissions
- [ ] Both of the above
- [ ] Also edit existing published Q&A

Answer: ALl of the above, so the user along with admin who is supposed to manage the ask the rabbi, this is what the PM voice message was to me eah, his computer, I guess, will remember his login. And as long as, when he logs in, I guess that it opens up automatically, then he doesn't have to go through all the steps of clicking to add message and clicking to the drop-down menu to ask the rabbi. And then, so if, with his login, it goes right into a open Ask the Rabbi blog, open Ask the Rabbi blog. So that Ask the Rabbi is already filled in. His picture is already filled in. And he just needs to put the title and copy and paste it into the body of the blog. And then just push upload. So, yeah, if we could do that, I guess we'll play around with, if that's too much. I'm sure if that's what he, I'm assuming that's what he did. As soon as he signed in to, from Toronto, and I'm assuming the browser remembered him, it just opened up right away into an Ask the Rabbi message article. . 

---

## BLOG

**B1. Image cropping — aspect ratio?**
Options:
- [ ] Fixed 16:9 (standard landscape)
- [ ] Fixed 3:1 (banner style)
- [ ] Square (1:1)
- [ ] User picks from options

Answer:

--- Lets discuss this, mayeb we should amek a mockup

**B2. Image cropping — cover image only, or also in-content images?**

Answer:

---We should ahve a shared image cropping component, that way it clean code

**B3. Featured blogger rotation — time window for "recent"?**
Options:
- [ ] Published a blog in the last 7 days
- [ ] Published a blog in the last 30 days
- [ ] Has the most blog views in last 30 days

Answer: What did the PM say in full context, and verbatim

---

**B4. What if no blog-writing businesses qualify for the "featured blogger" slot?**
Options:
- [ ] Show an extra paid business in that slot
- [ ] Show a "Write a blog to get featured" CTA card
- [ ] Leave the slot empty

Answer: What did the PM say in full context, and verbatim

---

## BUSINESSES & MONETIZATION

**BM1. MUX video — who uploads?**
Options:
- [ ] Admin uploads on behalf of business from admin panel
- [ ] Business owner self-uploads from their dashboard
- [ ] Both

Answer: Business owner uploads from their dashbaord, but admin needs to approve

---

**BM2. MUX video — which subscription tier includes it?**
Options:
- [ ] Premium and above
- [ ] Elite only
- [ ] All paid tiers (Standard+)

Answer: what do you think I think it should be elit only

---

**BM3. Non-profit document — accepted file types?**
Options:
- [ ] PDF only
- [ ] PDF + images (JPG/PNG)
- [ ] Any document type

Answer: Specifically Pdf +images

---

**BM4. Non-profit discount — how much off?**
Options:
- [ ] 50% off all tiers
- [ ] Custom price per plan (admin sets it in subscription plan admin)
- [ ] Fixed separate tier prices (e.g., Standard goes from $27 → $15 for non-profits)

Answer: Are we able to have it that admin can change it going forward. I want to understand how these subscriptions work meaning if right now its 45 dollars and "alex" signs up for 45 and down the line I charge 50 will alex plan go up by $5 dollars or is that for only new users

---

**BM5. Restaurant milk/meat — how does it interact with kosher badge?**
PM said "kosher badge does not make sense here." Options:
- [ ] Replace kosher badge with dairy/meat/pareve dropdown FOR RESTAURANTS ONLY
  (detect by category — businesses in the Restaurant category get this instead)
- [ ] Replace kosher badge globally with dairy/meat/pareve
- [ ] Show both (kosher badge + dairy/meat filter)

Answer: What did the PM say in full context, and verbatim

---

**BM6. Email shoutout content — who writes it?**
Options:
- [ ] Business writes their own copy + uploads image (submitted to admin for approval)
- [ ] Admin composes it on behalf of the business
- [ ] Auto-generated from business name, tagline, logo

Answer: Busines writes their own copy + uploads iamge submitted to admin for approval and we should ahve logic if admin rejects it and for them to give reason why optional. And user can submit new shoutout for approval. 

---

**BM7. Email shoutout — is this a one-time payment or included in subscription?**
Options:
- [ ] Included in subscription (part of what they pay monthly/yearly)
- [ ] Add-on one-time payment (new PayPal flow needed)
- [ ] Included only in certain tiers (e.g., Elite gets 1 free shoutout/year)

Answer:Included only in certain tiers (e.g., Elite gets 1 free shoutout/year)

---

**BM8. Ad frequency preferences (single ad / daily digest / weekly digest) — confirm understanding**
This is for business owners choosing how their promotions get distributed.
Is this a setting they pick during onboarding that determines:
- [ ] How often their listing appears in newsletter rotations
- [ ] What type of newsletter placement they're paying for
- [ ] Something else

Answer: Differnt plans but for now lets do once a year, and we should create a place for admins to manually go in and if they want allow certain users to have differnt amounts of tiems they can post. We should proabbly discuss

---

**BM9. Daily digest — does FrumToronto currently send a daily email?**
Currently only manual newsletters. Is "daily digest" a new recurring automated email we need to build?

Answer: No its not, they send out typically once a week, but admin sensding out newsleters should be manual. Basically the way they send out email once per week they have option to gatehr all the events of that week, as well as omer is option, etc. Do you remember we discussed this

---

## CLASSIFIEDS

**C1. Email relay — do we keep a log of contact attempts?**
Options:
- [ ] Yes, log all relay emails (for abuse/spam prevention)
- [ ] No, just pass-through

Answer: What do you mean email relay explain simple terms

---

**C2. Email relay — rate limiting?**
Suggestion: max 3 contact attempts per user per listing per 24 hours.
Agree, or different limit?

Answer: disagree, as many as needed
---

**C3. Description character limit — 2000 confirmed. Enforce where?**
Options:
- [ ] Form validation only (frontend)
- [ ] Form + API validation
- [ ] Form + API + database constraint (VARCHAR(2000))

Answer: is this reommended Form + API + database constraint (VARCHAR(2000)) what do you think

---

## NEWSLETTER

**NL1. Auto-content blocks — when does data get "frozen" for a send?**
Options:
- [ ] At time of clicking Send (freshest data, but previews may differ from actual send)
- [ ] At time of clicking Preview (frozen, what you see is what gets sent)

Answer: what do you mean I don't undetand qestions

---

**NL2. Sefirat HaOmer block — include on homepage widget too?**
Options:
- [ ] Newsletter block only (during Omer)
- [ ] Both newsletter block AND homepage widget
- [ ] Homepage widget only

Answer: what do you mean please explain

---

**NL3. Recent simchas block — which simcha types?**
Options:
- [ ] All simcha types (births, engagements, weddings)
- [ ] Births only
- [ ] User configurable (admin picks which types go in newsletter)

Answer: user confiugrable, to make ui/ux easier should have dropdown, what do you think

---

**NL4. Recent ATR question — how many?**
Options:
- [ ] Most recent 1 only
- [ ] Top 3 most recent
- [ ] Most viewed in last 7 

Answer:  the ones of that week.

---

**NL5. No business booked the shoutout slot for this send date — what shows?**
Options:
- [ ] Block is hidden
- [ ] Generic "Advertise here" CTA in that space
- [ ] Admin is warned and can choose

Answer: What do you think

---

## PERMISSIONS & NOTIFICATIONS

**P1. In-app notifications — who receives them?**
Options:
- [ ] Admins only (alert when trusted users post, when content needs review)
- [ ] All users (also notified when their content is approved, comments on their blog, etc.)
- [ ] Both (admins get admin alerts, users get user alerts)

Answer: Explain this to me when would users get notiications vs admin

---

**P2. Notification UI — where does it live?**
Options:
- [ ] Bell icon in admin header only
- [ ] Bell icon in both admin AND user dashboard header
- [ ] Dedicated /admin/notifications page + bell icon

Answer: deicatied /admin/notifications

---

**P3. Notifications retention — how long to keep?**
Options:
- [ ] 30 days
- [ ] 90 days
- [ ] Forever (archived, not deleted)

Answer: 30 days, write this a a note ina .md so I can tell client how it works

---

**P4. Permissions structure — flexible JSON vs individual flags?**
Currently: individual boolean columns per content type (canAutoApproveShiva, etc.)
Proposal for new `canManage*` flags: same pattern (individual columns) for consistency.
Or switch to a JSON permissions column for flexibility?

Answer: what do you reommend

---

**P5. Audit log — scope?**
Options:
- [ ] Log everything (every create, update, delete)
- [ ] Log sensitive actions only (approvals, role changes, deletions, logins)

Answer: log everything, but we need to figure out how to be organized


---

## ANALYTICS

**A1. Which metrics matter most for the admin dashboard?**
Check all that apply:
- [ ] Page views per page (top pages)
- [ ] Top businesses by views
- [ ] Top blog posts by views
- [ ] User signups over time
- [ ] Content submissions over time
- [ ] Newsletter open/click rates (already exists)
- [ ] Event views
- [ ] Search queries

Answer: Page views, user signups over time, blog posts by unique views, top business by views, search qurries, event views and unique views

---

**A2. Time range selector?**
Options:
- [ ] Fixed tabs: 7 days / 30 days / all time
- [ ] Custom date picker
- [ ] Both

Answer:Both

---

**A3. Analytics implementation — build ourselves vs Vercel Analytics?**
Vercel Analytics: plug-and-play traffic stats, free tier.
Custom: business-specific metrics (which businesses get most views, etc.)
Suggestion: Use Vercel Analytics for traffic + custom DB tables for content metrics.
Agree?

Answer: create cust db tabels for contect metrics

---

## UI / MISC

**UI1. Navbar 14" laptop — what's broken currently?**
Options:
- [ ] Nav items overflow/wrap
- [ ] Text is too large
- [ ] Logo + nav items don't fit together
- [ ] Specific breakpoint acting wrong

Answer: what did the pm meeting say exactly and context

---

**UI2. Smaller hero — which pages specifically?**
(Deferred from PM meeting — fill in here when ready)

Answer: what did the pm meeting say exactly and context

---

**UI3. Are there any features from the PM list you do NOT want built?**
List any items to drop or defer to a later phase:

Answer: we don't defere anything, we discuss first 

---

**UI4. Roll-out order — fix bugs first then write specs, or write all specs then implement?**
Options:
- [ ] Fix the 2 blog bugs immediately, then write specs for everything else
- [ ] Write all specs first, then implement in priority order

Answer: whatever you think is best

---

*Last updated: 2026-05-18*
