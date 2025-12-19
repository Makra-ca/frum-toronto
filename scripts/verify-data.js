// Verify data integrity for directory

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function verify() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('=== Data Verification ===\n');

  // 1. Check businesses with null category_id
  const nullCatBusinesses = await sql`
    SELECT COUNT(*) as count FROM businesses WHERE category_id IS NULL
  `;
  console.log(`Businesses with no category: ${nullCatBusinesses[0].count}`);

  // 2. Check businesses linked to parent categories (should be 0)
  const parentLinkedBiz = await sql`
    SELECT COUNT(*) as count
    FROM businesses b
    JOIN business_categories bc ON b.category_id = bc.id
    WHERE bc.parent_id IS NULL
  `;
  console.log(`Businesses linked to parent categories: ${parentLinkedBiz[0].count}`);

  // 3. Total active businesses
  const totalBiz = await sql`
    SELECT COUNT(*) as count FROM businesses WHERE is_active = true
  `;
  console.log(`Total active businesses: ${totalBiz[0].count}`);

  // 4. Show parent categories with no subcategories
  console.log('\n=== Parent Categories with 0 Subcategories ===');
  const emptyParents = await sql`
    SELECT bc.name, bc.slug
    FROM business_categories bc
    WHERE bc.parent_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM business_categories sub WHERE sub.parent_id = bc.id)
  `;
  emptyParents.forEach(p => console.log(`  - ${p.name} (${p.slug})`));

  // 5. Show top subcategories by business count
  console.log('\n=== Top 10 Subcategories by Business Count ===');
  const topSubcats = await sql`
    SELECT bc.name, p.name as parent_name, COUNT(b.id) as biz_count
    FROM business_categories bc
    JOIN business_categories p ON bc.parent_id = p.id
    LEFT JOIN businesses b ON b.category_id = bc.id AND b.is_active = true
    GROUP BY bc.id, bc.name, p.name
    ORDER BY biz_count DESC
    LIMIT 10
  `;
  topSubcats.forEach(s => console.log(`  ${s.biz_count} - ${s.name} (${s.parent_name})`));

  console.log('\n=== Verification Complete ===');
}

verify();
