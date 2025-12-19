// READ-ONLY exploration of directory tables in MSSQL
const sql = require('mssql');

const config = {
  user: 'frumto',
  password: '201518',
  server: '216.105.90.65',
  port: 1433,
  database: 'FrumToronto',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  }
};

async function explore() {
  try {
    await sql.connect(config);
    console.log('Connected to MSSQL\n');

    // Get DirectoryCategories structure
    console.log('=== DirectoryCategories Structure ===');
    const catCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DirectoryCategories'
      ORDER BY ORDINAL_POSITION
    `;
    console.table(catCols.recordset);

    // Sample categories
    console.log('\n=== Sample Categories (first 20) ===');
    const cats = await sql.query`SELECT TOP 20 * FROM DirectoryCategories ORDER BY ID`;
    console.table(cats.recordset);

    // Get parent categories (Group1 = main category grouping)
    console.log('\n=== Unique Group1 values (Main Categories) ===');
    const mainCats = await sql.query`
      SELECT DISTINCT DirectoryCategory, Group1
      FROM DirectoryCategories
      WHERE DirectoryCategory IS NOT NULL
      ORDER BY DirectoryCategory
    `;
    console.table(mainCats.recordset);

    // Get DirectoryListings structure
    console.log('\n=== DirectoryListings Structure ===');
    const listCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DirectoryListings'
      ORDER BY ORDINAL_POSITION
    `;
    console.table(listCols.recordset);

    // Sample listings
    console.log('\n=== Sample Listings (first 5) ===');
    const listings = await sql.query`SELECT TOP 5 * FROM DirectoryListings`;
    console.table(listings.recordset);

    // Count by category
    console.log('\n=== Listings Count by Category (top 20) ===');
    const countByCat = await sql.query`
      SELECT TOP 20
        dc.ID,
        dc.CategoryName,
        dc.DirectoryCategory,
        COUNT(dl.ID) as ListingCount
      FROM DirectoryCategories dc
      LEFT JOIN DirectoryListings dl ON dc.ID = dl.CategoryID
      GROUP BY dc.ID, dc.CategoryName, dc.DirectoryCategory
      HAVING COUNT(dl.ID) > 0
      ORDER BY ListingCount DESC
    `;
    console.table(countByCat.recordset);

    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

explore();
