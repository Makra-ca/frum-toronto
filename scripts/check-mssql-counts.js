const sql = require('mssql');

const config = {
  server: '216.105.90.65',
  user: 'frumto',
  password: '201518',
  database: 'FrumToronto',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkBusinessCounts() {
  try {
    console.log('Connecting to MSSQL database...\n');
    await sql.connect(config);
    console.log('Connected successfully!\n');

    // 1. Check Kosher Foods (Group1 = 1)
    console.log('=== KOSHER FOODS (Group1 = 1) ===');
    const kosherResult = await sql.query`
      SELECT
        c.Name as CategoryName,
        c.Group1,
        COUNT(l.ListingID) as TotalListings,
        SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) as ActiveListings,
        SUM(CASE WHEN l.Active = 0 THEN 1 ELSE 0 END) as InactiveListings
      FROM Categories c
      LEFT JOIN Listings l ON c.CategoryID = l.CategoryID
      WHERE c.Group1 = 1
      GROUP BY c.CategoryID, c.Name, c.Group1
      ORDER BY c.Name
    `;
    console.log(kosherResult.recordset);
    console.log('\n');

    // 2. Check Media & Communications (Group1 = 17)
    console.log('=== MEDIA & COMMUNICATIONS (Group1 = 17) ===');
    const mediaResult = await sql.query`
      SELECT
        c.Name as CategoryName,
        c.Group1,
        COUNT(l.ListingID) as TotalListings,
        SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) as ActiveListings,
        SUM(CASE WHEN l.Active = 0 THEN 1 ELSE 0 END) as InactiveListings
      FROM Categories c
      LEFT JOIN Listings l ON c.CategoryID = l.CategoryID
      WHERE c.Group1 = 17
      GROUP BY c.CategoryID, c.Name, c.Group1
      ORDER BY c.Name
    `;
    console.log(mediaResult.recordset);
    console.log('\n');

    // 3. Check Travel (Group1 = 18)
    console.log('=== TRAVEL (Group1 = 18) ===');
    const travelResult = await sql.query`
      SELECT
        c.Name as CategoryName,
        c.Group1,
        COUNT(l.ListingID) as TotalListings,
        SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) as ActiveListings,
        SUM(CASE WHEN l.Active = 0 THEN 1 ELSE 0 END) as InactiveListings
      FROM Categories c
      LEFT JOIN Listings l ON c.CategoryID = l.CategoryID
      WHERE c.Group1 = 18
      GROUP BY c.CategoryID, c.Name, c.Group1
      ORDER BY c.Name
    `;
    console.log(travelResult.recordset);
    console.log('\n');

    // 4. List all Group1 values with 0 active listings
    console.log('=== CATEGORIES WITH 0 ACTIVE LISTINGS (By Group1) ===');
    const zeroActiveResult = await sql.query`
      SELECT
        c.Group1,
        c.Name as CategoryName,
        COUNT(l.ListingID) as TotalListings,
        SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) as ActiveListings
      FROM Categories c
      LEFT JOIN Listings l ON c.CategoryID = l.CategoryID
      GROUP BY c.CategoryID, c.Name, c.Group1
      HAVING SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) = 0 OR SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) IS NULL
      ORDER BY c.Group1, c.Name
    `;
    console.log(zeroActiveResult.recordset);
    console.log('\n');

    // Summary by Group1
    console.log('=== SUMMARY BY GROUP1 ===');
    const summaryResult = await sql.query`
      SELECT
        c.Group1,
        COUNT(DISTINCT c.CategoryID) as TotalCategories,
        COUNT(l.ListingID) as TotalListings,
        SUM(CASE WHEN l.Active = 1 THEN 1 ELSE 0 END) as ActiveListings,
        SUM(CASE WHEN l.Active = 0 THEN 1 ELSE 0 END) as InactiveListings
      FROM Categories c
      LEFT JOIN Listings l ON c.CategoryID = l.CategoryID
      GROUP BY c.Group1
      ORDER BY c.Group1
    `;
    console.log(summaryResult.recordset);

    await sql.close();
    console.log('\nDatabase connection closed.');
  } catch (err) {
    console.error('Error:', err);
  }
}

checkBusinessCounts();
