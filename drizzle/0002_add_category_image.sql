-- Add image_url column to business_categories table
-- This stores the URL of the category hero image (uploaded via Vercel Blob)

ALTER TABLE "business_categories"
ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500);

-- Add a comment to the column for documentation
COMMENT ON COLUMN "business_categories"."image_url" IS 'Category hero image URL from Vercel Blob storage';
