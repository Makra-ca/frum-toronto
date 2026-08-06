---
name: print-via-window-print-with-ios-guards
description: Printing uses window.print() plus three iOS guards, not a server-generated PDF — the PDF route was a fix for the wrong diagnosis
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Printable pages use **`window.print()` with three iOS guards**, not a
server-generated PDF.

The guards, all of which the zmanim month sheet needs and any future printable
page will too:

1. **Pin `text-size-adjust: 100%`** — on the element *and again inside
   `@media print`*. iOS treats print as a separate cascade, so pinning it once
   is not enough.
2. **No `em` for inner sizes.** Relative units multiply the parent's *computed*
   font size, so a single boosted ancestor cascades into every child and every
   padding. Use absolute lengths.
3. **Reload after an App Router soft navigation on iOS.** `window.print()` stays
   wedged and the dialog silently never opens. `pushState` fires no event, so a
   `pageshow`/`persisted` hook does not cover it — detect a second mount in the
   same document instead (see `MonthPicker.tsx`).

**Context:** Sourced from `Makra-ca/idstrips`, which chased iOS printing through
several rounds. **The arc matters more than any single commit there.**

That project concluded `window.print()` was broken on iOS and built a
server-generated PDF — `pdf-lib`, bundled TTF fonts, `outputFileTracingIncludes`,
about 319 lines plus two route handlers. It then discovered the real cause was
iOS text autosizing bursting the layout, fixed that, and **restored the direct
Print button** (their `c72f68a0`), keeping the PDF only as a fallback.

So the elaborate solution in that repo's history is a fix for a misdiagnosis.
Copying it here would import a subsystem to solve a problem we do not have.

**Chose over:**

- *Server-generated PDF.* Rejected: it exists in idstrips for reasons that turned
  out not to hold, it needs bundled fonts and serverless tracing config, and a
  PDF cannot reflow — our sheet's whole width problem is solved by letting the
  browser lay it out. Reconsider only if a device is found where `window.print()`
  genuinely fails *after* the guards above are in place.
- *In-app-browser detection with a "open in Safari" hint.* idstrips shipped this
  (`58c4e185`) and later dropped it — Safari was failing too, so the detection
  was treating a symptom.
- *`transform: scale()` instead of CSS `zoom`.* Genuinely necessary there, and
  worth knowing (`text-size-adjust` does **not** suppress autosizing triggered by
  `zoom`) — but we use neither, so it does not apply.

**Consequences:**

- Print failures on this site are **layout** failures until proven otherwise.
  A 21-column sheet that clips does so because it is too wide, not because
  printing is broken.
- Width failures are **silent** — columns fall off the paper and nothing errors.
  Measure the table's natural width against the *usable* page width before
  assuming a print stylesheet works. Target **Letter**, not A4: the zmanim sheet
  measured 991px, which fits A4 and clips on Letter, and Letter is what Toronto
  prints on.
- Anything print-related that turns a layout mode off should ask what was
  propping that mode up. Our identity columns carried inline pixel widths purely
  so `position: sticky` could compute a left offset; print disabled sticky but
  the widths survived and ate 10% of the page.
