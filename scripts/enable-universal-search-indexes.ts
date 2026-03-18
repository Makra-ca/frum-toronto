/**
 * Create trigram indexes for universal fuzzy search across all content types.
 * Run with: npx tsx scripts/enable-universal-search-indexes.ts
 *
 * Prerequisites: pg_trgm extension must be enabled (done by enable-fuzzy-search.ts)
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

async function enableUniversalSearchIndexes() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const sql = neon(process.env.DATABASE_URL);

  // Ensure pg_trgm is enabled
  console.log("Ensuring pg_trgm extension...");
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  console.log("Creating trigram indexes...\n");

  // Shuls
  console.log("  Shuls: name, rabbi");
  await sql`CREATE INDEX IF NOT EXISTS idx_shuls_name_trgm ON shuls USING GIN (name gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shuls_rabbi_trgm ON shuls USING GIN (rabbi gin_trgm_ops)`;

  // Shiurim
  console.log("  Shiurim: title, teacher_name");
  await sql`CREATE INDEX IF NOT EXISTS idx_shiurim_title_trgm ON shiurim USING GIN (title gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shiurim_teacher_trgm ON shiurim USING GIN (teacher_name gin_trgm_ops)`;

  // Events
  console.log("  Events: title");
  await sql`CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops)`;

  // Businesses
  console.log("  Businesses: name, description");
  await sql`CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_businesses_description_trgm ON businesses USING GIN (description gin_trgm_ops)`;

  // Classifieds
  console.log("  Classifieds: title, description");
  await sql`CREATE INDEX IF NOT EXISTS idx_classifieds_title_trgm ON classifieds USING GIN (title gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_classifieds_description_trgm ON classifieds USING GIN (description gin_trgm_ops)`;

  // Ask the Rabbi indexes already exist (from enable-fuzzy-search.ts)
  console.log("  Ask the Rabbi: already indexed\n");

  console.log("All trigram indexes created successfully!");
}

enableUniversalSearchIndexes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
