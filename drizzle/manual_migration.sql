-- Manual migration to add auth tables and update users table
-- Run this in your Neon database console

-- Step 1: Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS image varchar(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;

-- Step 2: Handle email_verified column conversion (boolean to timestamp)
-- First, add a new temporary column
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_new timestamp;

-- Convert existing values: true -> current timestamp, false/null -> null
UPDATE users SET email_verified_new = CASE
    WHEN email_verified = true THEN now()
    ELSE NULL
END;

-- Drop old column and rename new one
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users RENAME COLUMN email_verified_new TO email_verified;

-- Make password_hash nullable (for OAuth users)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Step 3: Create accounts table (for OAuth providers)
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
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_provider_account_id
ON accounts(provider, provider_account_id);

-- Step 4: Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id serial PRIMARY KEY,
    session_token varchar(255) NOT NULL UNIQUE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires timestamp NOT NULL
);

-- Step 5: Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier varchar(255) NOT NULL,
    token varchar(255) NOT NULL UNIQUE,
    expires timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS verification_tokens_identifier_token
ON verification_tokens(identifier, token);

-- Step 6: Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token varchar(255) NOT NULL UNIQUE,
    expires timestamp NOT NULL,
    created_at timestamp DEFAULT now()
);
