-- Add approval_status column to tehillim_list table
ALTER TABLE "tehillim_list" ADD COLUMN IF NOT EXISTS "approval_status" varchar(20) DEFAULT 'pending';

-- Update existing records to be approved (so they remain visible)
UPDATE "tehillim_list" SET "approval_status" = 'approved' WHERE "approval_status" IS NULL;

-- Make hebrew_name nullable (either hebrew or english name required, validated in app)
ALTER TABLE "tehillim_list" ALTER COLUMN "hebrew_name" DROP NOT NULL;
