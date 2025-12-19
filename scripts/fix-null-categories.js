// Fix businesses with null category_id by looking up their original category

const sql = require('mssql');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const mssqlConfig = {
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

async function fixNullCategories() {
  const neonSql = neon(process.env.DATABASE_URL);

  try {
    await sql.connect(mssqlConfig);
    console.log('Connected to MSSQL\n');

    // 1. Get businesses with null category
    const nullBiz = await neonSql`
      SELECT id, old_id, name FROM businesses WHERE category_id IS NULL
    `;
    console.log(`Found ${nullBiz.length} businesses with null category\n`);

    if (nullBiz.length === 0) return;

    // 2. Get category mapping from Neon
    const categories = await neonSql`
      SELECT id, old_id, name FROM business_categories WHERE old_id IS NOT NULL
    `;
    const catMap = {};
    categories.forEach(c => { catMap[c.old_id] = c.id; });

    // 3. Look up original categories in MSSQL and update
    let fixed = 0;
    let skipped = 0;

    for (const biz of nullBiz) {
      if (!biz.old_id) {
        console.log(`  Skip "${biz.name}" - no old_id`);
        skipped++;
        continue;
      }

      // Get original listing from MSSQL
      const result = await sql.query`
        SELECT CategoryID1, CategoryID2, CategoryID3, CategoryID4, CategoryID5, CategoryID6
        FROM DirectoryListings
        WHERE ID = ${biz.old_id}
      `;

      if (!result.recordset[0]) {
        console.log(`  Skip "${biz.name}" - not found in MSSQL`);
        skipped++;
        continue;
      }

      const listing = result.recordset[0];

      // Find a valid category
      let newCatId = null;
      for (const catField of ['CategoryID1', 'CategoryID2', 'CategoryID3', 'CategoryID4', 'CategoryID5', 'CategoryID6']) {
        const oldCatId = listing[catField];
        if (oldCatId && catMap[oldCatId]) {
          newCatId = catMap[oldCatId];
          break;
        }
      }

      if (newCatId) {
        await neonSql`UPDATE businesses SET category_id = ${newCatId} WHERE id = ${biz.id}`;
        console.log(`  Fixed "${biz.name}" -> category ${newCatId}`);
        fixed++;
      } else {
        // Get category names from MSSQL
        const catResult = await sql.query`
          SELECT CategoryName FROM DirectoryCategories WHERE ID = ${listing.CategoryID1}
        `;
        const catName = catResult.recordset[0]?.CategoryName || 'Unknown';
        console.log(`  Skip "${biz.name}" - original category "${catName}" (ID: ${listing.CategoryID1}) not found`);
        skipped++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Skipped: ${skipped}`);

    await sql.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

fixNullCategories();
