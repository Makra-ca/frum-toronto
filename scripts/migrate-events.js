require('dotenv').config();
const sql = require('mssql');
const { Pool } = require('pg');

// MSSQL config
const mssqlConfig = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// PostgreSQL config
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Category mapping: old category ID -> new event type
const CATEGORY_MAP = {
  16: 'community',   // Community Events
  9: 'fundraising',  // Fundraising Events
  11: 'school',      // Community School Information
  17: 'wedding',     // Weddings
};

// Categories to migrate
const CATEGORIES_TO_MIGRATE = Object.keys(CATEGORY_MAP).map(Number);

// ---------------------------------------------------------------------------
// CLI options
//
// DRY RUN BY DEFAULT, matching every script in scripts/legacy-import/. This
// script originally had no dry run at all and wrote on sight.
//
//   node scripts/migrate-events.js                      # preview live events
//   node scripts/migrate-events.js --commit             # write them, approved
//   node scripts/migrate-events.js --onhold             # preview on-hold events
//   node scripts/migrate-events.js --onhold --commit    # write them, PENDING
//   ... --exclude=7312,7328                             # skip known duplicates
//
// TIMEZONE: combineDateAndTime() uses setHours(), which reads the MACHINE's
// timezone. The original February import ran on a Toronto machine, so the 44
// existing rows encode Toronto local time. Run this on a Toronto machine (or
// with TZ=America/Toronto) or the new rows will disagree with the old ones by
// the UTC offset.
// ---------------------------------------------------------------------------
const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes('--commit');
const ONHOLD_MODE = ARGS.includes('--onhold');
const EXCLUDE = new Set(
  (ARGS.find((a) => a.startsWith('--exclude=')) || '')
    .replace('--exclude=', '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
);

// On-hold rows were never public on the old site, so they arrive for review
// rather than going straight onto the calendar.
const APPROVAL_STATUS = ONHOLD_MODE ? 'pending' : 'approved';

/**
 * Convert OLE/Excel date to JavaScript Date
 * OLE date base is Dec 30, 1899
 */
function oleToDate(oleDate) {
  if (!oleDate) return null;
  const oleBaseDate = new Date(1899, 11, 30);
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(oleBaseDate.getTime() + oleDate * msPerDay);
}

/**
 * Parse time string like "7:30 P.M.", "6:00pm - 10:00pm", "Morning", etc.
 * Returns { startHour, startMinute, endHour, endMinute, isAllDay }
 */
function parseTimeString(timeStr) {
  if (!timeStr || timeStr.trim() === '') {
    return { isAllDay: true };
  }

  const normalized = timeStr.trim().toLowerCase();

  // Check for all-day indicators
  if (['all day', 'morning', 'afternoon', 'evening', '24 hours', 'tba', 'tbd'].some(s => normalized.includes(s))) {
    return { isAllDay: true };
  }

  // Try to extract time(s) using regex
  // Matches patterns like: 7:30 pm, 7:30pm, 7:30 P.M., 19:30
  const timeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi;
  const matches = [...timeStr.matchAll(timeRegex)];

  if (matches.length === 0) {
    return { isAllDay: true };
  }

  // A meridiem written once at the END of a range applies to the whole range.
  // "6:00-10:00 pm" is 6 PM to 10 PM, but the regex only attaches "pm" to the
  // token it directly follows, so the leading 6:00 arrived bare and defaulted
  // to 6 AM. Bnos Bais Yaakov PTA was about to be published as a 6 AM event.
  const trailingMeridiem = (normalized.match(/(am|pm|a\.m\.|p\.m\.)\s*$/) || [])[1];

  function parseMatch(match) {
    let hour = parseInt(match[1]);
    const minute = parseInt(match[2] || '0');
    let meridiem = (match[3] || '').toLowerCase().replace(/\./g, '');

    // Fall back to the range-level meridiem, then to PM. The old site stored
    // plenty of bare times ("9:00" for a melave malkah, "6:00-10:00" for a
    // PTA) and this is a community calendar: an unqualified evening-ish hour
    // is virtually always PM. An explicit "am" is always honoured.
    if (!meridiem && trailingMeridiem) {
      meridiem = trailingMeridiem.replace(/\./g, '');
    }
    if (!meridiem && hour >= 1 && hour <= 11) {
      meridiem = 'pm';
    }

    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    } else if (meridiem === 'am' && hour === 12) {
      hour = 0;
    }

    return { hour, minute };
  }

  const start = parseMatch(matches[0]);
  const end = matches.length > 1 ? parseMatch(matches[1]) : null;

  return {
    isAllDay: false,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end?.hour,
    endMinute: end?.minute,
  };
}

/**
 * Combine date and time into ISO string
 */
function combineDateAndTime(date, hour, minute) {
  const d = new Date(date);
  d.setHours(hour || 0, minute || 0, 0, 0);
  return d.toISOString();
}

/**
 * Clean and truncate text
 */
function cleanText(text, maxLength = null) {
  if (!text) return null;
  let cleaned = text.trim();
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...';
  }
  return cleaned || null;
}

async function migrateEvents() {
  let mssqlPool;
  let pgClient;

  try {
    console.log('Connecting to databases...');
    mssqlPool = await sql.connect(mssqlConfig);
    pgClient = await pgPool.connect();
    console.log('Connected to both databases.\n');

    // Calculate today's OLE date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oleToday = Math.floor((today.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000));

    console.log(`Fetching events from ${today.toDateString()} onwards (OLE date >= ${oleToday})...`);
    console.log(`Categories: ${CATEGORIES_TO_MIGRATE.join(', ')}\n`);

    // Fetch events from MSSQL
    const eventsResult = await mssqlPool.request()
      .query(`
        SELECT
          d.id,
          d.dte,
          d.eTime,
          d.text_field as title,
          d.Details as description,
          d.Category,
          d.Address,
          d.OtherLocation,
          d.OtherAddress,
          d.ContactName,
          d.ContactNumber,
          d.ContactEmail,
          d.Cost,
          d.onhold,
          dl.Company as venue_name,
          dl.Address as venue_address,
          dl.City as venue_city
        FROM FrumToronto.dbo.Diary d
        LEFT JOIN FrumToronto.dbo.DirectoryListings dl ON d.Address = dl.ID AND d.Address > 0
        WHERE d.dte >= ${oleToday}
          AND d.Category IN (${CATEGORIES_TO_MIGRATE.join(',')})
          AND ${ONHOLD_MODE ? 'd.onhold = 1' : '(d.onhold = 0 OR d.onhold IS NULL)'}
        ORDER BY d.dte ASC
      `);

    const events = eventsResult.recordset;
    console.log(`Found ${events.length} events to migrate.\n`);

    if (events.length === 0) {
      console.log('No events to migrate.');
      return;
    }

    // Check for existing migrated events
    const existingResult = await pgClient.query(
      'SELECT old_id FROM events WHERE old_id IS NOT NULL'
    );
    const existingOldIds = new Set(existingResult.rows.map(r => r.old_id));
    console.log(`Found ${existingOldIds.size} previously migrated events.\n`);

    let inserted = 0;
    let skipped = 0;
    let excluded = 0;
    let errors = 0;
    const preview = [];

    for (const event of events) {
      try {
        // Skip if already migrated
        if (existingOldIds.has(event.id)) {
          skipped++;
          continue;
        }

        // Skip ids named on --exclude (known duplicates of rows already here)
        if (EXCLUDE.has(event.id)) {
          console.log(`  Excluding old id ${event.id}: ${cleanText(event.title, 60)}`);
          excluded++;
          continue;
        }

        // Convert date
        const eventDate = oleToDate(event.dte);
        if (!eventDate) {
          console.log(`  Skipping event ${event.id}: Invalid date`);
          errors++;
          continue;
        }

        // Parse time
        const timeInfo = parseTimeString(event.eTime);

        // Build start/end times
        let startTime, endTime = null;

        if (timeInfo.isAllDay) {
          // All day event - set to midnight
          startTime = combineDateAndTime(eventDate, 0, 0);
        } else {
          startTime = combineDateAndTime(eventDate, timeInfo.startHour, timeInfo.startMinute);
          if (timeInfo.endHour !== undefined) {
            endTime = combineDateAndTime(eventDate, timeInfo.endHour, timeInfo.endMinute);
          }
        }

        // Build location string
        let location = null;
        if (event.venue_name) {
          location = event.venue_name;
          if (event.venue_address) {
            location += `, ${event.venue_address}`;
          }
          if (event.venue_city) {
            location += `, ${event.venue_city}`;
          }
        } else if (event.OtherLocation) {
          location = event.OtherLocation;
          if (event.OtherAddress) {
            location += `, ${event.OtherAddress}`;
          }
        }

        // Map category to event type
        const eventType = CATEGORY_MAP[event.Category] || 'community';

        // On a dry run, record what WOULD be written and move on.
        if (!COMMIT) {
          preview.push({
            oldId: event.id,
            title: cleanText(event.title, 44),
            startsToronto: new Date(startTime).toLocaleString('en-US', {
              timeZone: 'America/Toronto',
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            allDay: timeInfo.isAllDay,
            type: eventType,
            status: APPROVAL_STATUS,
          });
          inserted++;
          continue;
        }

        // Insert into PostgreSQL
        await pgClient.query(
          `INSERT INTO events (
            title, description, location, start_time, end_time, is_all_day,
            event_type, contact_name, contact_email, contact_phone, cost,
            approval_status, is_active, old_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            cleanText(event.title, 255),
            cleanText(event.description),
            cleanText(location, 500),
            startTime,
            endTime,
            timeInfo.isAllDay,
            eventType,
            cleanText(event.ContactName, 100),
            cleanText(event.ContactEmail, 255),
            cleanText(event.ContactNumber, 40),
            cleanText(event.Cost, 150),
            APPROVAL_STATUS, // 'approved' normally; 'pending' in --onhold mode
            true,
            event.id,
            new Date().toISOString(),
          ]
        );

        inserted++;

        if (inserted % 50 === 0) {
          console.log(`  Migrated ${inserted} events...`);
        }
      } catch (err) {
        console.error(`  Error migrating event ${event.id}:`, err.message);
        errors++;
      }
    }

    if (!COMMIT && preview.length) {
      console.log('\n--- would insert ---');
      console.table(preview);
    }

    console.log('\n============================================');
    console.log(COMMIT ? 'MIGRATION COMPLETE' : 'DRY RUN — nothing was written');
    console.log('============================================');
    console.log(`Mode: ${ONHOLD_MODE ? 'ON-HOLD rows' : 'live rows'} -> approval_status='${APPROVAL_STATUS}'`);
    console.log(`${COMMIT ? 'Inserted' : 'Would insert'}: ${inserted}`);
    console.log(`Skipped (already migrated): ${skipped}`);
    console.log(`Excluded (--exclude): ${excluded}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${events.length}`);
    if (!COMMIT) console.log('\nRe-run with --commit to write.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    if (mssqlPool) {
      await mssqlPool.close();
    }
    if (pgClient) {
      pgClient.release();
    }
    await pgPool.end();
  }
}

// Run migration
migrateEvents();
