// Cleanup bad category data

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function cleanup() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('=== Category Cleanup ===\n');

  // 1. Find and delete empty-name categories
  console.log('Step 1: Finding empty-name categories...');
  const emptyNames = await sql`
    SELECT id, name, slug, parent_id FROM business_categories
    WHERE name IS NULL OR name = '' OR TRIM(name) = ''
  `;
  console.log(`Found ${emptyNames.length} empty-name categories`);

  for (const cat of emptyNames) {
    // First, reassign any businesses to "Uncategorized"
    const uncatResult = await sql`
      SELECT id FROM business_categories WHERE slug = 'uncategorized' LIMIT 1
    `;
    if (uncatResult[0]) {
      await sql`
        UPDATE businesses SET category_id = ${uncatResult[0].id}
        WHERE category_id = ${cat.id}
      `;
    }
    // Delete the category
    await sql`DELETE FROM business_categories WHERE id = ${cat.id}`;
    console.log(`  Deleted category ID: ${cat.id}`);
  }

  // 2. Mark empty parent categories as inactive
  console.log('\nStep 2: Marking empty parent categories as inactive...');
  const emptyParents = await sql`
    SELECT bc.id, bc.name, bc.slug
    FROM business_categories bc
    WHERE bc.parent_id IS NULL
    AND bc.icon IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM business_categories sub WHERE sub.parent_id = bc.id
    )
  `;
  console.log(`Found ${emptyParents.length} parent categories with no subcategories`);

  for (const parent of emptyParents) {
    await sql`UPDATE business_categories SET is_active = false WHERE id = ${parent.id}`;
    console.log(`  Deactivated: ${parent.name} (${parent.slug})`);
  }

  // 3. Summary
  console.log('\n=== Cleanup Summary ===');
  const activeParents = await sql`
    SELECT COUNT(*) as count FROM business_categories
    WHERE parent_id IS NULL AND is_active = true
  `;
  const activeSubs = await sql`
    SELECT COUNT(*) as count FROM business_categories
    WHERE parent_id IS NOT NULL AND is_active = true
  `;
  console.log(`Active parent categories: ${activeParents[0].count}`);
  console.log(`Active subcategories: ${activeSubs[0].count}`);

  console.log('\n=== Done ===');
}

cleanup();
