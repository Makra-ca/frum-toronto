-- Add display_order column to businesses table for manual ordering within categories
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
