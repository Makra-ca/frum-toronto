/**
 * Migration script to populate category images from existing fallback URLs
 *
 * Run with: npx tsx scripts/migrate-category-images.ts
 */

import { db } from "../src/lib/db";
import { businessCategories } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

// Category slug to image URL mapping (from AmazonStyleBrowser fallbacks)
const categoryImageMap: Record<string, string> = {
  "restaurants-catering": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=300&fit=crop",
  "jewish-services": "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?w=600&h=300&fit=crop",
  "business-services": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop",
  "health-beauty": "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=600&h=300&fit=crop",
  "home-garden": "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=300&fit=crop",
  "financial-services": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop",
  "education": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=300&fit=crop",
  "shopping": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop",
  "simchas": "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=300&fit=crop",
  "property-accommodations": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=300&fit=crop",
  "transport-auto": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&h=300&fit=crop",
  "services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=300&fit=crop",
  "clothing-accessories": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=300&fit=crop",
  "kosher-foods": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop",
  "government-institutions": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=300&fit=crop",
  "sport-leisure": "https://images.unsplash.com/photo-1461896836934-df9aa02a7c84?w=600&h=300&fit=crop",
  "media-communications": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&h=300&fit=crop",
  "travel": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=300&fit=crop",
};

// Default image for categories without a specific mapping
const defaultImage = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=300&fit=crop";

async function migrateCategoryImages() {
  console.log("Starting category image migration...\n");

  try {
    // Get all categories
    const categories = await db
      .select({
        id: businessCategories.id,
        name: businessCategories.name,
        slug: businessCategories.slug,
        imageUrl: businessCategories.imageUrl,
        parentId: businessCategories.parentId,
      })
      .from(businessCategories);

    console.log(`Found ${categories.length} categories\n`);

    let updated = 0;
    let skipped = 0;

    for (const category of categories) {
      // Skip if already has an image
      if (category.imageUrl) {
        console.log(`⏭️  ${category.name} - already has image, skipping`);
        skipped++;
        continue;
      }

      // Only set images for parent categories (no parentId)
      if (category.parentId !== null) {
        console.log(`⏭️  ${category.name} - is a subcategory, skipping`);
        skipped++;
        continue;
      }

      // Get the image URL from the map or use default
      const imageUrl = categoryImageMap[category.slug] || defaultImage;

      // Update the category
      await db
        .update(businessCategories)
        .set({ imageUrl })
        .where(eq(businessCategories.id, category.id));

      console.log(`✅ ${category.name} (${category.slug}) - set image`);
      updated++;
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Migration complete!`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`${"=".repeat(50)}`);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateCategoryImages();
