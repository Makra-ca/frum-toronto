-- Migration: Make shuls standalone (remove business dependency)

-- Add new columns to shuls table
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "name" varchar(200);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "slug" varchar(200);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "address" varchar(500);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "city" varchar(100) DEFAULT 'Toronto';
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 8);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "longitude" numeric(11, 8);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "phone" varchar(40);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "email" varchar(255);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "logo_url" varchar(500);
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "shuls" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

-- Migrate data from businesses table to shuls (for any existing shuls)
UPDATE "shuls" s
SET
  name = b.name,
  slug = b.slug,
  description = b.description,
  address = b.address,
  city = b.city,
  postal_code = b.postal_code,
  latitude = b.latitude,
  longitude = b.longitude,
  phone = b.phone,
  email = b.email,
  website = b.website,
  logo_url = b.logo_url
FROM "businesses" b
WHERE s.business_id = b.id AND s.name IS NULL;

-- For any shuls without a business, set a default name
UPDATE "shuls" SET name = 'Unnamed Shul', slug = 'shul-' || id WHERE name IS NULL;

-- Now make name and slug NOT NULL
ALTER TABLE "shuls" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "shuls" ALTER COLUMN "slug" SET NOT NULL;

-- Add unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shuls_slug" ON "shuls" ("slug");

-- Drop the business_id foreign key constraint and column
ALTER TABLE "shuls" DROP CONSTRAINT IF EXISTS "shuls_business_id_businesses_id_fk";
ALTER TABLE "shuls" DROP COLUMN IF EXISTS "business_id";
