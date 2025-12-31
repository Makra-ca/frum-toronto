import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  console.log("Starting migration...\n");

  try {
    // Step 1: Add new columns to users table
    console.log("Step 1: Adding new columns to users table...");
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS image varchar(500)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false`;
    console.log("✓ Added image and is_trusted columns\n");

    // Step 2: Handle email_verified column conversion
    console.log("Step 2: Converting email_verified from boolean to timestamp...");

    // Check if email_verified_new already exists
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'email_verified_new'
    `;

    if (columns.length === 0) {
      // Check current type of email_verified
      const emailVerifiedType = await sql`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email_verified'
      `;

      if (emailVerifiedType.length > 0 && emailVerifiedType[0].data_type === 'boolean') {
        await sql`ALTER TABLE users ADD COLUMN email_verified_new timestamp`;
        await sql`UPDATE users SET email_verified_new = CASE WHEN email_verified = true THEN now() ELSE NULL END`;
        await sql`ALTER TABLE users DROP COLUMN email_verified`;
        await sql`ALTER TABLE users RENAME COLUMN email_verified_new TO email_verified`;
        console.log("✓ Converted email_verified to timestamp\n");
      } else {
        console.log("✓ email_verified is already timestamp type\n");
      }
    } else {
      console.log("✓ Migration already in progress, skipping email_verified conversion\n");
    }

    // Step 3: Make password_hash nullable
    console.log("Step 3: Making password_hash nullable...");
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
    console.log("✓ password_hash is now nullable\n");

    // Step 4: Create accounts table
    console.log("Step 4: Creating accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type varchar(255) NOT NULL,
        provider varchar(255) NOT NULL,
        provider_account_id varchar(255) NOT NULL,
        refresh_token text,
        access_token text,
        expires_at integer,
        token_type varchar(255),
        scope varchar(255),
        id_token text,
        session_state varchar(255)
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_provider_account_id
      ON accounts(provider, provider_account_id)
    `;
    console.log("✓ Created accounts table\n");

    // Step 5: Create sessions table
    console.log("Step 5: Creating sessions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id serial PRIMARY KEY,
        session_token varchar(255) NOT NULL UNIQUE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires timestamp NOT NULL
      )
    `;
    console.log("✓ Created sessions table\n");

    // Step 6: Create verification_tokens table
    console.log("Step 6: Creating verification_tokens table...");
    await sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier varchar(255) NOT NULL,
        token varchar(255) NOT NULL UNIQUE,
        expires timestamp NOT NULL
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS verification_tokens_identifier_token
      ON verification_tokens(identifier, token)
    `;
    console.log("✓ Created verification_tokens table\n");

    // Step 7: Create password_reset_tokens table
    console.log("Step 7: Creating password_reset_tokens table...");
    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token varchar(255) NOT NULL UNIQUE,
        expires timestamp NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `;
    console.log("✓ Created password_reset_tokens table\n");

    console.log("🎉 Migration completed successfully!");

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
