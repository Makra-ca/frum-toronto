import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

const migration = fs.readFileSync('./drizzle/0001_make_shuls_standalone.sql', 'utf-8');

// Split by semicolons and run each statement
const statements = migration
  .split(/;[\s]*\n/)
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

async function run() {
  console.log('Running shuls migration...\n');

  for (const statement of statements) {
    if (statement) {
      const preview = statement.substring(0, 70).replace(/\n/g, ' ');
      console.log('Running:', preview + '...');
      try {
        // Use db.execute with sql.raw for dynamic SQL statements
        await db.execute(sql.raw(statement));
        console.log('✓ Success\n');
      } catch (e: unknown) {
        const error = e as Error;
        console.log('✗ Error:', error.message, '\n');
      }
    }
  }

  console.log('Migration complete!');
}

run();
