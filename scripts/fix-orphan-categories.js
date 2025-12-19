// Fix orphan categories that were migrated without a parent
// These categories have parent_id = null but are NOT true parent categories

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function fixOrphanCategories() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Step 1: Find orphan categories (parent_id is null but no icon - not a true parent)
    console.log('=== Finding Orphan Categories ===');
    const orphans = await sql`
      SELECT id, name, slug, old_id
      FROM business_categories
      WHERE parent_id IS NULL AND icon IS NULL
      ORDER BY name
    `;

    console.log(`Found ${orphans.length} orphan categories:`);
    orphans.forEach(o => console.log(`  - ${o.name} (ID: ${o.id})`));

    if (orphans.length === 0) {
      console.log('No orphan categories to fix!');
      return;
    }

    // Step 2: Create an "Other Services" parent category for miscellaneous items
    console.log('\n=== Creating "Other" Parent Category ===');

    const existingOther = await sql`
      SELECT id FROM business_categories WHERE slug = 'other'
    `;

    let otherParentId;
    if (existingOther.length > 0) {
      otherParentId = existingOther[0].id;
      console.log(`  "Other" category already exists (ID: ${otherParentId})`);
    } else {
      const result = await sql`
        INSERT INTO business_categories (name, slug, icon, display_order, is_active)
        VALUES ('Other', 'other', 'MoreHorizontal', 99, true)
        RETURNING id
      `;
      otherParentId = result[0].id;
      console.log(`  Created "Other" parent category (ID: ${otherParentId})`);
    }

    // Step 3: Update orphan categories to have the "Other" parent
    console.log('\n=== Assigning Orphans to "Other" Parent ===');

    for (const orphan of orphans) {
      await sql`
        UPDATE business_categories
        SET parent_id = ${otherParentId}
        WHERE id = ${orphan.id}
      `;
      console.log(`  Updated "${orphan.name}" to have parent "Other"`);
    }

    // Step 4: Verify the fix
    console.log('\n=== Verification ===');
    const remainingOrphans = await sql`
      SELECT COUNT(*) as count
      FROM business_categories
      WHERE parent_id IS NULL AND icon IS NULL
    `;
    console.log(`Remaining orphan categories: ${remainingOrphans[0].count}`);

    // Step 5: Show parent categories with business counts
    console.log('\n=== Parent Categories Summary ===');
    const parents = await sql`
      SELECT
        bc.id, bc.name, bc.slug, bc.icon,
        (SELECT COUNT(*) FROM business_categories WHERE parent_id = bc.id) as subcat_count,
        (SELECT COUNT(*) FROM businesses b
         JOIN business_categories sub ON b.category_id = sub.id
         WHERE sub.parent_id = bc.id AND b.is_active = true) as business_count
      FROM business_categories bc
      WHERE bc.parent_id IS NULL
      ORDER BY bc.display_order
    `;

    parents.forEach(p => {
      console.log(`  ${p.name}: ${p.subcat_count} subcategories, ${p.business_count} businesses`);
    });

    console.log('\n=== Fix Complete ===');
  } catch (err) {
    console.error('Error:', err);
  }
}

fixOrphanCategories();
