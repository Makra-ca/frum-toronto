# Claude Memory - FrumToronto Project

## Communication Style
- Be straightforward, no BS answers
- Ask questions when something is vague
- Don't assume, clarify

## CRITICAL WARNING
- **DO NOT DELETE OR EDIT ANY DATA IN THE MSSQL DATABASE**
- Only run SELECT queries - READ-ONLY operations
- The existing database is production data for the client
- **DO NOT run `npm run build` until user says so**
- **DO NOT run type checks (`npx tsc --noEmit`) until user says so**

## Project Context
- Client project - modernizing existing frumtoronto.com
- Design should be UNIQUE and MODERN (not copying old design, just functionality)
- Community website for religious Jewish Toronto community

## Technical Stack
- Frontend: Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui
- Database: **Neon DB (PostgreSQL)** - migrating FROM MSSQL
- ORM: Drizzle
- Image Storage: **Vercel Blob**
- Auth: NextAuth.js (fresh start - no password migration)
- Payments: Stripe (paid business tiers)
- Hosting: Vercel

## Existing MSSQL Database (READ-ONLY)
- Server: 216.105.90.65
- User: frumto / Password: 201518
- Databases: FrumShared, FrumToronto

### Key Tables to Migrate:
- BlogEntries (34,295 rows) → ask_the_rabbi (CategoryID=98)
- DirectoryListings (1,814) → businesses
- Classified (1,660) → classifieds
- Diary (6,016) → events
- DiaryShiurim (282) → shiurim
- DaveningSchedule (734) → davening_schedules
- MemberList (3,264) → email_subscribers

### Migration Notes:
- Dates are Excel serial format (float) - convert with: new Date((float - 25569) * 86400 * 1000)
- Passwords are plain text - NOT migrating (fresh auth)
- Images stored as filenames - need to find server path and migrate to Vercel Blob

## Core Features (from old site analysis)
- Business directory with categories
- Shul listings with davening times
- Businesses can post their hours/menus
- Events calendar
- Community announcements (simchas, shiva, etc.)
- Ask the Rabbi
- Alerts (kosher, bulletins)
- Classifieds
- Eruv status
- Zmanim (Jewish prayer times)

## API Routes Documentation
When creating or modifying API routes, document them in `docs/API_ROUTES.md` using this format:

```markdown
### GET/POST `/api/[path]`
Brief description of what the endpoint does.

**Query Parameters:** (if applicable)
| Param | Type | Description |
|-------|------|-------------|
| `param` | type | description |

**Response:**
```json
{
  "field": "value"
}
```
```
