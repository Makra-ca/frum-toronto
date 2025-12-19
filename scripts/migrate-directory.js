// Migration script: MSSQL DirectoryCategories & DirectoryListings -> Neon PostgreSQL
// READ from MSSQL, WRITE to Neon

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

// Parent category mapping based on Group1 values from old system
const GROUP_TO_PARENT = {
  1: { name: 'Kosher Foods', slug: 'kosher-foods', icon: 'UtensilsCrossed' },
  2: { name: 'Restaurants & Catering', slug: 'restaurants-catering', icon: 'ChefHat' },
  3: { name: 'Jewish Services', slug: 'jewish-services', icon: 'Star' },
  4: { name: 'Financial Services', slug: 'financial-services', icon: 'DollarSign' },
  5: { name: 'Government & Institutions', slug: 'government-institutions', icon: 'Building2' },
  6: { name: 'Education', slug: 'education', icon: 'GraduationCap' },
  7: { name: 'Services', slug: 'services', icon: 'Wrench' },
  8: { name: 'Business Services', slug: 'business-services', icon: 'Briefcase' },
  9: { name: 'Property & Accommodations', slug: 'property-accommodations', icon: 'Building' },
  10: { name: 'Simchas', slug: 'simchas', icon: 'PartyPopper' },
  11: { name: 'Clothing & Accessories', slug: 'clothing-accessories', icon: 'Shirt' },
  12: { name: 'Shopping', slug: 'shopping', icon: 'ShoppingBag' },
  13: { name: 'Home & Garden', slug: 'home-garden', icon: 'Home' },
  14: { name: 'Transport & Auto', slug: 'transport-auto', icon: 'Car' },
  15: { name: 'Sport & Leisure', slug: 'sport-leisure', icon: 'Dumbbell' },
  16: { name: 'Health & Beauty', slug: 'health-beauty', icon: 'Heart' },
  17: { name: 'Media & Communications', slug: 'media-communications', icon: 'Radio' },
  18: { name: 'Travel', slug: 'travel', icon: 'Plane' },
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&#47;/g, '-')
    .replace(/&#45;/g, '-')
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#47;/g, '/')
    .replace(/&#45;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n');
}

async function migrate() {
  const neonSql = neon(process.env.DATABASE_URL);

  try {
    await sql.connect(mssqlConfig);
    console.log('Connected to MSSQL\n');

    // Step 1: Create parent categories in Neon
    console.log('=== Creating Parent Categories ===');
    const parentIdMap = {};

    for (const [groupId, parent] of Object.entries(GROUP_TO_PARENT)) {
      const existing = await neonSql`
        SELECT id FROM business_categories WHERE slug = ${parent.slug}
      `;

      if (existing.length > 0) {
        parentIdMap[groupId] = existing[0].id;
        console.log(`  Parent "${parent.name}" already exists (ID: ${existing[0].id})`);
      } else {
        const result = await neonSql`
          INSERT INTO business_categories (name, slug, icon, display_order, is_active)
          VALUES (${parent.name}, ${parent.slug}, ${parent.icon}, ${parseInt(groupId)}, true)
          RETURNING id
        `;
        parentIdMap[groupId] = result[0].id;
        console.log(`  Created parent "${parent.name}" (ID: ${result[0].id})`);
      }
    }

    // Step 2: Migrate subcategories from MSSQL
    console.log('\n=== Migrating Subcategories ===');
    const categories = await sql.query`
      SELECT ID, CategoryName, Group1, Active, DCount
      FROM DirectoryCategories
      WHERE Active = 1 AND CategoryName IS NOT NULL
      ORDER BY Group1, CategoryName
    `;

    const categoryIdMap = {}; // old ID -> new ID
    let catCount = 0;

    for (const cat of categories.recordset) {
      const name = decodeHtmlEntities(cat.CategoryName);
      const slug = slugify(cat.CategoryName);
      const parentId = parentIdMap[cat.Group1] || null;

      // Check if already exists
      const existing = await neonSql`
        SELECT id FROM business_categories WHERE slug = ${slug} AND parent_id = ${parentId}
      `;

      if (existing.length > 0) {
        categoryIdMap[cat.ID] = existing[0].id;
      } else {
        try {
          const result = await neonSql`
            INSERT INTO business_categories (name, slug, parent_id, is_active, old_id)
            VALUES (${name}, ${slug}, ${parentId}, true, ${cat.ID})
            RETURNING id
          `;
          categoryIdMap[cat.ID] = result[0].id;
          catCount++;
        } catch (err) {
          // Handle duplicate slug by appending old ID
          const uniqueSlug = `${slug}-${cat.ID}`;
          const result = await neonSql`
            INSERT INTO business_categories (name, slug, parent_id, is_active, old_id)
            VALUES (${name}, ${uniqueSlug}, ${parentId}, true, ${cat.ID})
            RETURNING id
          `;
          categoryIdMap[cat.ID] = result[0].id;
          catCount++;
        }
      }
    }
    console.log(`  Migrated ${catCount} subcategories`);

    // Step 3: Migrate business listings
    console.log('\n=== Migrating Business Listings ===');
    const listings = await sql.query`
      SELECT
        ID, Active, Company, Slogan, ShortDescription, Description,
        Address, Unit, City, Province, PostalCode, Country,
        PhoneNumber, PhoneNumber2, FaxNumber, CellNumber,
        WebUrl, Email, ContactName, Keywords,
        CategoryID1, CategoryID2, CategoryID3, CategoryID4, CategoryID5, CategoryID6,
        Latitude, Longitude, ShomerShabbos, Minyan, Photo1
      FROM DirectoryListings
      WHERE Active = 1 AND ShowListing = 1
      ORDER BY Company
    `;

    let bizCount = 0;
    let skipCount = 0;

    for (const listing of listings.recordset) {
      const name = decodeHtmlEntities(listing.Company);
      if (!name) {
        skipCount++;
        continue;
      }

      let slug = slugify(name);
      const description = decodeHtmlEntities(listing.Description || listing.ShortDescription || listing.Slogan);

      // Build full address
      let address = listing.Address || '';
      if (listing.Unit) address += ` ${listing.Unit}`;
      address = address.trim();

      // Get primary category
      const primaryCatId = categoryIdMap[listing.CategoryID1] || null;

      // Check if already exists
      const existing = await neonSql`
        SELECT id FROM businesses WHERE old_id = ${listing.ID}
      `;

      if (existing.length > 0) {
        continue;
      }

      // Make slug unique if needed
      const slugCheck = await neonSql`
        SELECT id FROM businesses WHERE slug = ${slug}
      `;
      if (slugCheck.length > 0) {
        slug = `${slug}-${listing.ID}`;
      }

      try {
        await neonSql`
          INSERT INTO businesses (
            name, slug, category_id, description,
            address, city, postal_code, phone, email, website,
            latitude, longitude, is_kosher, is_featured,
            approval_status, is_active, old_id
          ) VALUES (
            ${name}, ${slug}, ${primaryCatId}, ${description},
            ${address}, ${listing.City || 'Toronto'}, ${listing.PostalCode},
            ${listing.PhoneNumber}, ${listing.Email}, ${listing.WebUrl},
            ${listing.Latitude || null}, ${listing.Longitude || null},
            ${listing.ShomerShabbos || false}, false,
            'approved', true, ${listing.ID}
          )
        `;
        bizCount++;

        if (bizCount % 100 === 0) {
          console.log(`  Migrated ${bizCount} businesses...`);
        }
      } catch (err) {
        console.error(`  Error migrating "${name}": ${err.message}`);
        skipCount++;
      }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`  Categories: ${Object.keys(parentIdMap).length} parents + ${catCount} subcategories`);
    console.log(`  Businesses: ${bizCount} migrated, ${skipCount} skipped`);

    await sql.close();
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
