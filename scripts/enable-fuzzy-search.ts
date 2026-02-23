/**
 * Enable pg_trgm extension for fuzzy text search
 * Run with: npx tsx scripts/enable-fuzzy-search.ts
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

async function enableFuzzySearch() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Enabling pg_trgm extension...");

  // Enable the pg_trgm extension for trigram-based fuzzy matching
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  console.log("pg_trgm extension enabled!");

  // Create GIN index for faster fuzzy searches on ask_the_rabbi
  console.log("Creating trigram indexes on ask_the_rabbi...");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ask_rabbi_title_trgm
    ON ask_the_rabbi USING GIN (title gin_trgm_ops)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ask_rabbi_question_trgm
    ON ask_the_rabbi USING GIN (question gin_trgm_ops)
  `;

  console.log("Indexes created successfully!");
  console.log("\nFuzzy search is now enabled. The search will match typos like:");
  console.log('  - "pruim" → "Purim"');
  console.log('  - "seuada" → "seuda"');
  console.log('  - "shabos" → "Shabbos"');
}

enableFuzzySearch()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
