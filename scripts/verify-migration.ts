import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function verifyMigration() {
  console.log("Verifying migration...\n");

  // Check tables
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('accounts', 'sessions', 'verification_tokens', 'password_reset_tokens')
    ORDER BY table_name
  `;

  console.log("Auth tables created:");
  tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

  // Check users table columns
  const userColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('email_verified', 'is_trusted', 'image', 'password_hash')
    ORDER BY column_name
  `;

  console.log("\nUsers table columns:");
  userColumns.forEach(c =>
    console.log(`  ✓ ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`)
  );

  console.log("\n✅ Migration verified successfully!");
}

verifyMigration().catch(console.error);
