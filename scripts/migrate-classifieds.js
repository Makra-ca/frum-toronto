// Migration script: Classifieds from MSSQL to Neon PostgreSQL
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

// Convert Excel serial date to JavaScript Date
function excelToDate(serial) {
  if (!serial) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString();
}

// Create slug from name
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function migrate() {
  const pgSql = neon(process.env.DATABASE_URL);

  // Connect to MSSQL
  await sql.connect(mssqlConfig);
  console.log('Connected to MSSQL (FrumToronto)');

  // Step 1: Migrate Categories
  console.log('\n=== Migrating Classified Categories ===');

  const categories = await sql.query`
    SELECT ID, CategoryName, IsGroup, PreviousID
    FROM ClassifiedCategories
    WHERE CategoryName IS NOT NULL AND CategoryName != ''
    ORDER BY ID
  `;

  let categoriesMigrated = 0;
  const categoryMap = new Map(); // oldId -> newId

  for (const cat of categories.recordset) {
    try {
      // Skip group categories (they are parent groupings in old system)
      if (cat.IsGroup) continue;

      const slug = createSlug(cat.CategoryName);

      const result = await pgSql`
        INSERT INTO classified_categories (name, slug, display_order, old_id)
        VALUES (${cat.CategoryName.trim()}, ${slug}, ${cat.ID}, ${cat.ID})
        ON CONFLICT (slug) DO UPDATE SET old_id = ${cat.ID}
        RETURNING id
      `;

      categoryMap.set(cat.ID, result[0].id);
      categoriesMigrated++;
    } catch (err) {
      console.error(`  Error migrating category ${cat.ID}:`, err.message);
    }
  }

  console.log(`  Migrated ${categoriesMigrated} categories`);

  // Step 2: Migrate Classifieds
  console.log('\n=== Migrating Classified Listings ===');

  const classifieds = await sql.query`
    SELECT c.*, cc.CategoryName
    FROM Classified c
    LEFT JOIN ClassifiedCategories cc ON c.CategoryID = cc.ID
    ORDER BY c.ID
  `;

  console.log(`Found ${classifieds.recordset.length} classifieds to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of classifieds.recordset) {
    try {
      // Skip if no title
      if (!item.ClassifiedTitle || item.ClassifiedTitle.trim() === '') {
        skipped++;
        continue;
      }

      // Get the new category ID
      let newCategoryId = null;
      if (item.CategoryID) {
        newCategoryId = categoryMap.get(item.CategoryID);

        // If category was a group, try to find it by name
        if (!newCategoryId && item.CategoryName) {
          const catResult = await pgSql`
            SELECT id FROM classified_categories WHERE name = ${item.CategoryName.trim()} LIMIT 1
          `;
          if (catResult.length > 0) {
            newCategoryId = catResult[0].id;
          }
        }
      }

      const title = item.ClassifiedTitle.trim();
      const description = item.ClassifiedDetails || '';
      const contactEmail = item.Email || null;
      const expiresAt = excelToDate(item.EndDte);
      const createdAt = excelToDate(item.StartDte) || new Date().toISOString();
      const isActive = !item.OnHold && (item.EndDte ? item.EndDte >= 45000 : true); // Active if not on hold and not too old

      // Check if already migrated
      const existing = await pgSql`SELECT id FROM classifieds WHERE old_id = ${item.ID} LIMIT 1`;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await pgSql`
        INSERT INTO classifieds (
          category_id, title, description, contact_email,
          expires_at, approval_status, is_active, created_at, old_id
        )
        VALUES (
          ${newCategoryId}, ${title}, ${description}, ${contactEmail},
          ${expiresAt}, 'approved', ${isActive}, ${createdAt}, ${item.ID}
        )
      `;

      migrated++;

      if (migrated % 200 === 0) {
        console.log(`  Migrated ${migrated} classifieds...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error migrating ID ${item.ID}:`, err.message);
      }
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`  Categories migrated: ${categoriesMigrated}`);
  console.log(`  Classifieds migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Get final counts
  const catCount = await pgSql`SELECT COUNT(*) as cnt FROM classified_categories`;
  const classCount = await pgSql`SELECT COUNT(*) as cnt FROM classifieds`;
  console.log(`\n  Total in classified_categories table: ${catCount[0].cnt}`);
  console.log(`  Total in classifieds table: ${classCount[0].cnt}`);

  await sql.close();
}

migrate().catch(console.error);
