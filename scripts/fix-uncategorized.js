// Assign uncategorized businesses to an "Uncategorized" subcategory

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function fixUncategorized() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Get the "Other" parent category
    const otherParent = await sql`
      SELECT id FROM business_categories WHERE slug = 'other'
    `;

    if (otherParent.length === 0) {
      console.log('Error: "Other" parent category not found');
      return;
    }

    const otherParentId = otherParent[0].id;
    console.log(`Found "Other" parent (ID: ${otherParentId})`);

    // 2. Create "Uncategorized" subcategory if not exists
    const existingUncat = await sql`
      SELECT id FROM business_categories WHERE slug = 'uncategorized'
    `;

    let uncatId;
    if (existingUncat.length > 0) {
      uncatId = existingUncat[0].id;
      console.log(`"Uncategorized" already exists (ID: ${uncatId})`);
    } else {
      const result = await sql`
        INSERT INTO business_categories (name, slug, parent_id, is_active)
        VALUES ('Uncategorized', 'uncategorized', ${otherParentId}, true)
        RETURNING id
      `;
      uncatId = result[0].id;
      console.log(`Created "Uncategorized" subcategory (ID: ${uncatId})`);
    }

    // 3. Update businesses with null category
    const updateResult = await sql`
      UPDATE businesses
      SET category_id = ${uncatId}
      WHERE category_id IS NULL
      RETURNING id
    `;

    console.log(`Updated ${updateResult.length} businesses to "Uncategorized"`);

    // 4. Verify
    const nullCount = await sql`
      SELECT COUNT(*) as count FROM businesses WHERE category_id IS NULL
    `;
    console.log(`Remaining businesses with null category: ${nullCount[0].count}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

fixUncategorized();
