# Ask the Rabbi — archive audit and open decisions

**Date:** 2026-08-06
**Databases:** production Neon (`ep-still-truth-ahj20cmx`) and legacy MSSQL `FrumShared.dbo.BlogEntries` category 98 (`216.105.90.65`, read-only)
**Status:** import complete · 40 rows changed that the Rabbi has since asked us not to change · rollback prepared, **not run**

---

## 1. The short version

| Question | Answer |
|---|---|
| Does the old database still hold questions we don't have? | **No.** 5,822 of 5,835 imported; the other 13 are accounted for |
| Are there Q&As that exist **only** in our database? | **Yes — 9**, plus 1 comment and 1 submission |
| Has anything been deleted or hidden on the old site since the import? | **No.** 0 gone, 0 deactivated, 0 moved category |
| Are the 14 shailos the Rabbi is chasing in the old database? | **No.** They exist only in his 31 July email |
| Can we parse that email automatically? | **Yes** — verified on 5 blocks, but needs the original message, not a retyped copy |

---

## 2. What exists only in our database

These nine have **no legacy counterpart at all** — the old site's numbering stops at **#6011**, so nothing on their side could ever produce them. They were typed directly into the new admin. **If anyone ever "resyncs from the old database", these are what disappears.**

| id | Title | Entered | Credit line in answer |
|---|---|---|---|
| 5520 | `6012 - An Interesting Shailah?` | 23 Jul 17:13 | **missing** |
| 5521 | `6013 – Even More Interesting Now!` | 23 Jul 17:14 | **missing** |
| 5522 | `6014 – Last Seudah Before Tisha Beav` | 23 Jul 17:16 | **missing** |
| 5523 | `6015 – The Non Banquet Seuda!` | 23 Jul 17:17 | yes |
| 5524 | `6016 - An Alcohol Problem?` | 23 Jul 17:18 | yes |
| 5525 | `6017 – Really! The Last Drink?- Querido Rabino` | 23 Jul 17:19 | yes |
| 5526 | `6018 – The Last Meal?` | 23 Jul 17:20 | yes |
| 5527 | `6024 - Dance at the Right Wedding!` | 30 Jul 10:05 | yes |
| 5528 | `6019 - A Good Moon Blessing!` | 3 Aug 09:53 | yes |

**Also cloud-only:**

- **1 comment** (id 3, "hi test", approved, on question 5527) — a test comment, probably worth removing.
- **1 pending submission (id 5), and it is from RABBI BARTFELD himself**, reading *"any questions sent to question and answer 6030"*. He used the site's own question form and it has been sitting unanswered in the queue. **This should be looked at first — the Rabbi is waiting on a reply through our system.**
- **0 page views** recorded across all 5,831 questions, so no analytics would be lost in any scenario.

### Two defects in those nine

1. **Row 5527 (`6024`) has answer text inside its question field.** The question ends `…on that day? A. On question 5094 we wrote: Q. Kvod Horav…` and the answer then starts `A. Zohar (2 p. 195)…`. Whoever entered it pasted the whole email block and cut it at the wrong place. Front-end display will show part of the answer as the question.
2. **Rows 5520, 5521, 5522 have no credit line.** Every other question in the archive ends with `Rabbi A. Bartfeld as revised by…` (5,430 of 5,831 answers). These three dropped it during manual entry.

Both are on **our** rows, not the Rabbi's archive.

---

## 3. Import status — the old database is fully across

| | Count |
|---|---|
| Legacy category 98, total | 5,838 |
| Legacy category 98, `Active = 1` | **5,835** |
| Imported into `ask_the_rabbi` | **5,822** |
| Typed on the new site | 9 |
| **Our total** | **5,831** |

**The 13 not imported, itemised:**

- **3 are blank** — title `FrumToronto Article`, body is `<br />` only (legacy ids 22721, 35251, 35771).
- **10 are the same question posted twice** — #5594, #5781, #5784, #5826, #5896, #5915, #5916, #5917, #5921, #5979. Similarity of the pairs measured 0.976–1.000. #5915/#5916/#5917 were posted 18 May and re-posted together 27 May.

Re-running the importer now reports **0 to insert**. There is nothing left to bring over.

### Why the gap existed

`scripts/migrate-ask-rabbi.js` ran around **December 2025** and stopped at **#5701 (12 Dec 2025)**. The Rabbi kept posting on the **old** site for another seven months, through **#6011 (18 Jul 2026)**, then switched to the new admin at **#6012 (23 Jul 2026)**. Those seven months — 311 questions — were never carried over until 5 Aug 2026.

A few were lost to a bug rather than to timing: the old script matched `/#(\d+)/` against **raw HTML**, which matched the entity `&#8203;` instead of the question number. Two different questions both became `8203`, collided on `UNIQUE(question_number)`, and were dropped by a `catch` block that only incremented a counter. Their real numbers are **2156** and **2998**.

---

## 4. The 14 shailos that are genuinely missing

The Rabbi's 31 July email to Alan contains sixteen questions, **6019 – 6034**. Two were entered by hand (6019, 6024). **Fourteen have never been posted anywhere:**

> **6020, 6021, 6022, 6023, 6025, 6026, 6027, 6028, 6029, 6030, 6031, 6032, 6033, 6034**

They are not in the old database (which stops at 6011) and not on the new site. **No import can find them.** This — not the legacy archive — is what "PLEASE KINDLY UPLOAD THE MISSING SHAILOS" refers to.

### The email format parses cleanly

Verified against 5 blocks, read-only, nothing written:

```
 6020 - Extended Restrictions? - Q. Rabbi. I have another question…
 A. Shulchan Aruch (O.H. 558: 1) mentions that…
 Rabbi A. Bartfeld as revised by Horav Y. Hirshman, …
```

- **Block boundary** — a line beginning with a 4-digit number then a dash.
- **Title** — between that dash and the ` - Q. ` separator.
- **Q/A boundary** — the **first** `A.` at a line start.
- **Credit line** — the trailing `Rabbi A. Bartfeld…` paragraph.

Both hard cases worked:

- **6024 has no `Q.` marker at all** (`Dance at the Right Wedding!- Rov Shlit'a. How important…`).
- **6024's answer contains a nested `Q.`/`A.`** quoting question 5094. Cutting at the first line-start `A.` still lands correctly.

Nested markers are the norm, not an edge case: **5,463 of 5,835 legacy answers contain more than one `A.`**, because answers routinely quote an earlier Q&A.

### Two different credit lines in one email

```
6019–6023: … Horav Kalman Ochs, and Horav Dovid Bartfeld consulting,
           Horav Hagaon Rav Yitzchak Berkowitz Shlit'a
6024–6034: … Horav Chanoch Ehrentreu and Horav Kalman Ochs Shlit'a
```

Only **71 rows in the whole archive** mention Berkowitz, so the reviewing panel changed recently. The credit line must be preserved **per question**, exactly as written — not normalised.

### Blocker

The parser is not the problem; **the source text is**. These are psak. A dropped word in *"provided the recipient's life is at risk"* changes the ruling, and text retyped out of a chat message cannot be proven to match what the Rabbi wrote.

**Needed:** the original email forwarded, or saved as `.eml`/`.txt`, so the 14 answers are parsed from the Rabbi's own bytes. Each extracted question can then be shown beside its source block before anything is written.

**Also undecided:** the email carries no per-question date. 6019 and 6024 were given 3 Aug and 30 Jul by hand. Someone has to choose what the other 14 get.

---

## 5. How a question is stored

| Field | Contents |
|---|---|
| `title` | **Carries the number** — `#5947 – Time to Celebrate?`. 5,787 titles start with `#NNNN`; 15 use a bare number; 1 has none |
| `question` | The shaila, plain text |
| `answer` | The teshuva, plain text — **the credit line lives here**, at the end |
| `answered_by` | A fixed column value, **identical on all 5,831 rows**: `Hagaon Rav Shlomo Miller Shlit'a` |
| `question_number` | Internal. **Not displayed on either public page** — only the SEO meta description and prev/next ordering |
| `category`, `image_url` | **Unused — 0 rows** |

Two consequences worth remembering:

- The panel of reviewing rabbonim is **body text, not metadata**. Anything new must follow that convention or it will render differently from every other question.
- Only **1,913** rows have `question_number` populated, though **5,787** titles visibly carry a number. The 2025 extractor missed most of them because many old titles are written `# 2156` **with a space**, which its pattern didn't match. Recoverable — but it means editing existing records, so it is parked (§6).

---

## 6. Changes made on 5 Aug that the Rabbi has asked us to undo

The Rabbi's instruction, received after the work was done:

> **PLEASE KINDLY UPLOAD THE MISSING SHAILOS** — the 311 import ✅
> **AND DO NOT CHANGE THE FORMER ONES** — 40 existing rows were changed ❌

| Change | Rows | Existed before | Created that day |
|---|---|---|---|
| Renumbered — `question_number` **and** the `#NNNN` in the title | 36 | 36 | 0 |
| Entity fix — row 2011, `8203` → `2006` | 1 | 1 | 0 |
| Q/A re-split | 7 | 1 | **6** |
| Byline fix — re-derived from legacy source | 2 | 2 | 0 |
| **Distinct rows touched** | **46** | **40** | **6** |

The six created that day are part of the 311 and have no "former" version; they are **not** covered by the instruction.

### Why the renumbering is the serious one

`#5264` was the only genuine misnumbering in all 324 — two different questions sharing a number (`Safe Sick Music?` already live, `A Happy Yohrzait?` incoming). The new one was placed at 5265 and the block above shifted up to the first free slot (5301), rewriting 36 published titles.

**This broke two of the Rabbi's own citations:**

| Row | Question | Cites | Now points at |
|---|---|---|---|
| 5595 | #5765 | "On question **5295** we wrote…" | the wrong question (old 5295 is now 5296) |
| 5604 | #5774 | "On question **5287** we wrote…" | the wrong question (old 5287 is now 5288) |

**1,326 of 5,831 answers (23%) cite another question by number.** The number is the citation key for a 5,800-entry halachic corpus, not a display detail — which is exactly what the Rabbi's instruction protects, particularly with the Vaad Harabonim discussion pending.

A pre-check for citations into the shifted range returned 0 **before** the import. That was true at the time and became stale: both citing rows arrived with the 311.

### Rollback

`scripts/legacy-import/atr-renumber-backup-2026-08-05T21-07-11-106Z.json` holds the pre-change `question_number` and `title` for all 36, plus row 2011. Restoration is exact.

`#5264 A Happy Yohrzait?` then has no free number, so it should go in with `question_number` **NULL** and its title left exactly as the Rabbi wrote it. It joins ~3,918 rows already in that state, and the duplicate number becomes a question for the Vaad rather than for us.

**Three rows need a decision rather than an automatic revert** — 22, 769 and 5301. These are not changes to good data; they are repairs of errors the 2025 migration introduced. Row 22's `answer` field literally read `Bartfeld`, with the actual ruling stranded in the question. Reverting puts a visibly broken record back on the site. Worth putting to Alan and the Rabbi as a repair, not a change of ruling.

**Proposed:** revert 37 automatically (36 renumbers + row 2011), hold 3 pending his answer.

---

## 7. Also parked until the Vaad reports

**4,436 of 5,831 questions (76%) display raw HTML entity codes to readers.** The 2025 migration's decoder had no Windows-1252 mapping, so bodies still contain `&#146;` where an apostrophe belongs. Confirmed to render literally — `src/app/ask-the-rabbi/[id]/page.tsx:104` passes the text as a JSX child, so React escapes it. 18 titles are affected too, e.g. `#22 - Lost Track of Ma&#146;aser.`

This is the same cp1252 bug already fixed for 1,168 simcha rows; Ask the Rabbi was never repaired. **The 311 newly imported rows have zero** — they went through `htmlToText`, which carries the correct table.

Fixing it means editing published rows, so it waits for the same decision.

---

## 8. Unrelated but found on the way

`connectTarget()` in `scripts/legacy-import/lib.ts` resolved `--test` runs to **production**. Every runner calls `loadLegacyEnv()` first, which loads `.env` and sets `DATABASE_URL` to primary; `dotenv` does not overwrite an already-set variable, so the later `.env.test` load was a no-op while the banner still printed `TEST BRANCH`. **Every importer in that folder was affected.** A `--test --commit` run wrote to production on 5 Aug.

Fixed in commit `9c9918d` — the target is now parsed from the env file directly, with an assertion that refuses to run when `--test` resolves to the same host as `.env`.

---

## 9. Next actions

1. **Answer the Rabbi's pending submission** (id 5) — he is waiting inside our own system.
2. **Get the original 31 July email** so the 14 missing shailos can be parsed from source.
3. **Decide the rollback** — 37 automatic, 3 to put to him.
4. **Decide dates** for the 14 once the email is in hand.
5. Hold the entity repair (§7) and the `question_number` recovery (§5) until the Vaad reports.

## Commits

| | |
|---|---|
| `9c9918d` | `fix(legacy-import): --test could silently target production` |
| `f53f169` | `feat(ask-the-rabbi): import the 311 questions the 2025 migration missed` |
| `fa26d6b` | `chore(ask-the-rabbi): snapshot from the test-branch import run` |
