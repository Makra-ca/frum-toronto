import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

async function run() {
  console.log('Checking shuls table columns...\n');

  const result = await db.execute(sql.raw(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'shuls'
    ORDER BY ordinal_position
  `));

  console.log('Columns in shuls table:');
  console.table(result.rows);
}

run();
