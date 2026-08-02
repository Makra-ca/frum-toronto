# Newsletters: findable by name, managed from one screen

**Date:** 2026-08-02
**Status:** approved, not implemented

## Problem

Three readers wrote in:

> *"I used to print 'Israel News' and with your designed website I no longer see it. Where can I find it now."*

> *"Where can you get the weekly Israel Newsletter from Bayt."*

Nothing is broken. The feature to host this already exists, is linked in the public nav twice, and returns 200. It has **zero rows**. Someone built the shelf and nobody ever stocked it, so a reader who used to print Israel News arrives at a page headed "Newsletters" holding six parsha sheets from shuls they may not attend, and concludes it is gone.

Two fixable things sit underneath that:

**Readers search by name, the page organises by date.** `community_newsletters.publisher` is stored and never used. "Israel News" is not a heading anywhere — it would be one card among many, and last week's issue is lost by date rather than one click away.

**Nobody can tell where to upload it.** Four screens are involved and three carry the same word:

| Screen | What it does |
|---|---|
| Sidebar → **Newsletters** | Sends email to the subscriber list |
| Community → **Newsletters** | Community PDFs — feeds the public page |
| Shuls → *a shul* → **Docs** | Shul PDFs — also feeds the public page |

The public `/newsletters` page is fed by **two tables** (`community_newsletters`, `shul_documents`) managed in **two unrelated places**, so no admin screen answers "what is live right now?". Picking the wrong one either does nothing or emails the entire community.

The existing admin page already carries the note *"This is separate from the email newsletter system"* — written by someone who hit this exact confusion.

## Decisions

| Decision | Choice |
|---|---|
| Structure | **Keep both tables.** One admin screen reads across them |
| Admin scope | See everything, edit only what that screen owns |
| Public change | **Group by publisher**, so a named series is findable |
| Naming | Rename so no two admin items share a word |
| Order | **Public grouping first** — it is what the emails are about |
| Not doing | Merging tables · notifications · renaming the public page |

**Why not merge the tables.** A shul newsletter genuinely belongs to a shul and has its own uploader — `api/shuls/[id]/documents/route.ts:60` runs `canUserManageShul`, so a shul manager can post their own without an admin. Merging rewires that path and the shul detail page for what is mostly a naming problem. (All six existing rows were in fact uploaded by `admin@frumtoronto.com`, so the capability is designed-for but unexercised — a reason to preserve it carefully, not to discard it.)

## Public page

`src/app/(public)/newsletters/page.tsx` already fetches the two sets separately and renders Community above Shul. The change is within the community section: group by `publisher`, newest series first.

```
Israel News                                  ← the words people wrote in asking for
  ┌──────────────────┐
  │ Week of Aug 3    │   latest issue, prominent
  └──────────────────┘
  Past issues: Jul 27 · Jul 20 · Jul 13      ← collapsed

Shul Newsletters
  … unchanged
```

Newsletters with no publisher fall into an "Other" group rather than disappearing.

**`publisher` is optional free text.** Typing `Israel News` one week and `Israeli News` the next silently creates two series, and the reader sees their archive split in half. Guard: offer existing publishers as a `<datalist>` on the admin form so the second week is a pick, not a retype. Deliberately not a foreign key — a publisher table is more machinery than a weekly PDF upload warrants, and the datalist removes the realistic failure without it.

## Admin

### Renames

| Now | Becomes | Why |
|---|---|---|
| `AdminLayoutClient.tsx:42` — "Newsletters" | **Email Campaigns** | It sends to the list. The name should say so, because getting this wrong is the expensive mistake |
| `community/layout.tsx:12` — "Newsletters" | unchanged | Now genuinely the public page's admin home |
| Shuls → Docs | unchanged | Per-shul and correctly scoped |

### Community → Newsletters becomes the mirror

Three blocks:

1. **Add a newsletter** — the existing form, plus the publisher datalist
2. **Community newsletters** — the existing list
3. **Shul newsletters** — *read-only*, each showing its shul and linking through to that shul's Docs

Block 3 is the answer to "no single screen shows what is live". Editing stays where ownership is, so a shul manager's upload is still theirs; this screen only reveals it. A line at the top points at Email Campaigns so nobody lands here expecting to email the community.

## Components

| File | Change |
|---|---|
| `src/app/(public)/newsletters/page.tsx` | Group community newsletters by publisher; latest prominent, rest collapsed |
| `src/lib/newsletters/group-by-publisher.ts` | **New.** Pure grouping + ordering, testable without a database |
| `src/app/(admin)/admin/community/newsletters/page.tsx` | Publisher datalist; read-only shul block |
| `src/app/api/admin/newsletters/shul-list/route.ts` | **New.** Shul newsletters for the read-only block |
| `src/components/admin/AdminLayoutClient.tsx` | Rename to "Email Campaigns" |

No schema change. No migration.

## Testing

The grouping module is pure, so most of this is unit-level:

- Two issues sharing a publisher form one series, newest first
- A missing publisher lands in "Other" rather than vanishing
- `Israel News` and `Israeli News` are **different** series — pins the fragility the datalist mitigates, so nobody later "fixes" it with fuzzy matching
- Series order by newest issue, not alphabetically
- The read-only shul block never exposes an edit or delete action
- Renaming the sidebar item does not change any route

Integration: the public page renders a community newsletter under its publisher heading, and shul newsletters still appear.

## Deliberately not in scope

- **Merging the tables** — see above
- **Notifying subscribers** of a new bulletin — the thing has not been posted once; premature
- **Renaming the public page** — "Newsletters" reads fine once a series carries its own name
- **Adding BAYT to the shul directory** — it is absent, which is why this must be a *community* newsletter with BAYT as publisher. Whether BAYT should be in the directory is a real question, and a separate one

## The part no software fixes

Someone has to get the bulletin from BAYT each week and upload it. The admin can post the first one today, with the current form, before any of this is built. This spec makes the second, tenth and fiftieth issue findable — it does not make the first one appear.
