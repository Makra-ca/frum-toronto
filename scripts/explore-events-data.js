require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function exploreEventsData() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connected to MSSQL');

    // Get categories first
    console.log('\n============================================================');
    console.log('EVENT CATEGORIES (Diary_Categorys)');
    console.log('============================================================\n');

    const categories = await pool.request()
      .query('SELECT * FROM FrumToronto.dbo.Diary_Categorys ORDER BY Cat_ID');
    console.table(categories.recordset);

    // Get sample events to understand date format
    console.log('\n============================================================');
    console.log('SAMPLE EVENTS (Diary) - First 10');
    console.log('============================================================\n');

    const sampleEvents = await pool.request()
      .query(`
        SELECT TOP 10
          id, dte, eTime, text_field, Category,
          OtherLocation, ContactName, ContactEmail, Cost,
          onhold, Email
        FROM FrumToronto.dbo.Diary
        ORDER BY dte DESC
      `);
    console.table(sampleEvents.recordset);

    // Check date format - get min and max dates
    console.log('\n============================================================');
    console.log('DATE ANALYSIS');
    console.log('============================================================\n');

    const dateAnalysis = await pool.request()
      .query(`
        SELECT
          MIN(dte) as min_date,
          MAX(dte) as max_date,
          COUNT(*) as total_events,
          COUNT(CASE WHEN onhold = 0 OR onhold IS NULL THEN 1 END) as active_events,
          COUNT(CASE WHEN onhold = 1 THEN 1 END) as on_hold_events
        FROM FrumToronto.dbo.Diary
      `);
    console.log('Date stats:', dateAnalysis.recordset[0]);

    // The date appears to be in Excel/OLE date format (days since 1899-12-30)
    // Let's verify by converting a sample
    const minDate = dateAnalysis.recordset[0].min_date;
    const maxDate = dateAnalysis.recordset[0].max_date;

    // Convert OLE date to JS date
    function oleToDate(oleDate) {
      if (!oleDate) return null;
      // OLE date base is Dec 30, 1899
      const oleBaseDate = new Date(1899, 11, 30);
      const msPerDay = 24 * 60 * 60 * 1000;
      return new Date(oleBaseDate.getTime() + oleDate * msPerDay);
    }

    console.log(`\nDate interpretation (assuming OLE/Excel format):`);
    console.log(`  Min date value ${minDate} = ${oleToDate(minDate)?.toISOString()}`);
    console.log(`  Max date value ${maxDate} = ${oleToDate(maxDate)?.toISOString()}`);

    // Get events by category count
    console.log('\n============================================================');
    console.log('EVENTS BY CATEGORY');
    console.log('============================================================\n');

    const byCategory = await pool.request()
      .query(`
        SELECT
          d.Category,
          dc.Category as CategoryName,
          COUNT(*) as event_count
        FROM FrumToronto.dbo.Diary d
        LEFT JOIN FrumToronto.dbo.Diary_Categorys dc ON d.Category = dc.Cat_ID
        GROUP BY d.Category, dc.Category
        ORDER BY event_count DESC
      `);
    console.table(byCategory.recordset);

    // Check Locations table for Address mapping
    console.log('\n============================================================');
    console.log('LOCATIONS (for Address mapping)');
    console.log('============================================================\n');

    const locations = await pool.request()
      .query('SELECT * FROM FrumToronto.dbo.Locations ORDER BY ID');
    console.table(locations.recordset);

    // Sample event with full details
    console.log('\n============================================================');
    console.log('FULL EVENT EXAMPLE (most recent active event)');
    console.log('============================================================\n');

    const fullEvent = await pool.request()
      .query(`
        SELECT TOP 1 *
        FROM FrumToronto.dbo.Diary
        WHERE (onhold = 0 OR onhold IS NULL)
        ORDER BY dte DESC
      `);
    console.log(JSON.stringify(fullEvent.recordset[0], null, 2));

    // Check if Address references DirectoryListings
    console.log('\n============================================================');
    console.log('ADDRESS REFERENCES - Checking if Address maps to DirectoryListings');
    console.log('============================================================\n');

    const addressCheck = await pool.request()
      .query(`
        SELECT TOP 5
          d.id, d.Address, d.OtherLocation, d.OtherAddress,
          dl.Company, dl.Address as ListingAddress, dl.City
        FROM FrumToronto.dbo.Diary d
        LEFT JOIN FrumToronto.dbo.DirectoryListings dl ON d.Address = dl.ID
        WHERE d.Address IS NOT NULL AND d.Address > 0
        ORDER BY d.dte DESC
      `);
    console.table(addressCheck.recordset);

    // Recent future events (after today's OLE date)
    const today = new Date();
    const oleToday = Math.floor((today.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000));

    console.log('\n============================================================');
    console.log(`FUTURE EVENTS (dte > ${oleToday}, which is ${today.toDateString()})`);
    console.log('============================================================\n');

    const futureEvents = await pool.request()
      .query(`
        SELECT TOP 20
          id, dte, eTime, text_field, Category, OtherLocation, Cost, onhold
        FROM FrumToronto.dbo.Diary
        WHERE dte >= ${oleToday}
        ORDER BY dte ASC
      `);
    console.table(futureEvents.recordset);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

exploreEventsData();
