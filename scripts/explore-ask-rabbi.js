// Explore the Ask the Rabbi data in MSSQL (READ-ONLY)

const sql = require('mssql');

const config = {
  server: '216.105.90.65',
  user: 'frumto',
  password: '201518',
  database: 'FrumShared',  // Try FrumShared instead
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function explore() {
  try {
    await sql.connect(config);
    console.log('Connected to MSSQL (FrumShared)\n');

    // List all tables
    console.log('=== All Tables ===');
    const tables = await sql.query`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    tables.recordset.forEach(t => console.log('  ' + t.TABLE_NAME));

    // Check BlogEntries table structure
    console.log('\n=== BlogEntries Table Structure ===');
    const columns = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'BlogEntries'
      ORDER BY ORDINAL_POSITION
    `;
    console.log(columns.recordset);

    // Check BlogCategories to find Ask the Rabbi category
    console.log('\n=== Blog Categories ===');
    const categories = await sql.query`
      SELECT * FROM BlogCategories ORDER BY BlogCategoryID
    `;
    categories.recordset.forEach(cat => {
      console.log(`  ID ${cat.BlogCategoryID}: ${cat.BlogCategoryName}`);
    });

    // Count entries by category
    console.log('\n=== Entry Counts by Category ===');
    const counts = await sql.query`
      SELECT bc.BlogCategoryID, bc.BlogCategoryName, COUNT(be.BlogEntryID) as EntryCount
      FROM BlogCategories bc
      LEFT JOIN BlogEntries be ON bc.BlogCategoryID = be.BlogCategoryID AND be.Active = 1
      GROUP BY bc.BlogCategoryID, bc.BlogCategoryName
      ORDER BY EntryCount DESC
    `;
    counts.recordset.forEach(row => {
      console.log(`  ${row.BlogCategoryName}: ${row.EntryCount} entries`);
    });

    // Sample Ask the Rabbi entries (assuming category name contains "Rabbi")
    console.log('\n=== Sample Ask the Rabbi Entries ===');
    const samples = await sql.query`
      SELECT TOP 5 be.*, bc.BlogCategoryName
      FROM BlogEntries be
      JOIN BlogCategories bc ON be.BlogCategoryID = bc.BlogCategoryID
      WHERE bc.BlogCategoryName LIKE '%Rabbi%' OR bc.BlogCategoryName LIKE '%Ask%'
      ORDER BY be.BlogEntryID DESC
    `;
    samples.recordset.forEach((row, i) => {
      console.log(`\n--- Entry ${i + 1} ---`);
      console.log('ID:', row.BlogEntryID);
      console.log('Category:', row.BlogCategoryName);
      console.log('Title:', row.BlogEntryTitle?.substring(0, 100));
      console.log('Text (first 300 chars):', row.BlogEntryText?.substring(0, 300));
      console.log('Date:', row.BlogEntryDate);
      console.log('Active:', row.Active);
    });

    await sql.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

explore();
