/**
 * Migration script to add per-field auto-approve permissions to users table
 * Run with: npx dotenv -e .env -- npx tsx scripts/add-user-permissions.ts
 */

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Starting migration: Adding user auto-approve permissions...\n");

  try {
    // Add new permission columns to users table
    const alterUsersSql = sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS can_auto_approve_shiva BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_tehillim BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_businesses BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_ask_the_rabbi BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_kosher_alerts BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_shuls BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_simchas BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_events BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_auto_approve_classifieds BOOLEAN DEFAULT false
    `;

    await db.execute(alterUsersSql);
    console.log("✓ Added auto-approve permission columns to users table");

    // Migrate existing isTrusted users - give them all permissions
    const migrateTrustedUsersSql = sql`
      UPDATE users
      SET
        can_auto_approve_shiva = true,
        can_auto_approve_tehillim = true,
        can_auto_approve_businesses = true,
        can_auto_approve_ask_the_rabbi = true,
        can_auto_approve_kosher_alerts = true,
        can_auto_approve_shuls = true,
        can_auto_approve_simchas = true,
        can_auto_approve_events = true,
        can_auto_approve_classifieds = true
      WHERE is_trusted = true
    `;

    const result = await db.execute(migrateTrustedUsersSql);
    console.log("✓ Migrated existing trusted users to have all auto-approve permissions");

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
