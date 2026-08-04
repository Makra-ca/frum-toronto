---
name: images-are-logo-and-banner-only
description: Owner-editable images means logo and banner; the photo gallery is excluded because it does not exist
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** Owner-editable images are **logo and banner**. The photo gallery is
out of scope and becomes its own project. A rejected image change **deletes the
uploaded blob**.

**Context:** An earlier draft listed "photo gallery" among editable fields and
cited `maxPhotos` (Free 0 · Standard 5 · Premium 15 · Elite 999) as a limit to
enforce on save. Then the check: `business_photos` appears in `src/` **twice** —
the table definition and a relation. No API, no UI, no query, no rendering, and
**zero rows**. The public listing page does not mention photos at all.

So the gallery is not a field to gate; it is an entire subsystem — upload,
ordering, deletion, storage, rendering — that would have been smuggled into the
scope by a single word in a list.

**Consequences:** Uploads go directly to Blob storage when the file is picked,
before the form is submitted, so the file exists at a public URL before it
reaches the review queue. The pending row stores that URL; approving swaps it
onto the listing; rejecting deletes the blob, or every rejected logo becomes
billed storage pointing at nothing.

**Known gap, accepted:** `/api/upload` DELETE is admin-only, so admin rejection
can delete, but an owner who replaces their own logo before review — or abandons
the form after uploading — orphans a blob with no cleanup path. Recorded so it is
not rediscovered as a surprise.

**The general lesson:** a field name in a list is not evidence the field exists.
This is the fifth built-but-unwired system found in two days, after Mux, the
homepage ads, the three permission toggles and the audit log.
