-- Migration: Alerts Schema Update
-- Date: 2026-02-24
-- Description: Add fields for kosher alerts user submission and community alerts notification preference

-- Add columns to kosher_alerts table for user submissions
ALTER TABLE kosher_alerts
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Add community_alerts notification preference to email_subscribers
ALTER TABLE email_subscribers
ADD COLUMN IF NOT EXISTS community_alerts BOOLEAN DEFAULT false;

-- Note: Existing kosher_alerts will have approval_status='approved' (admin-created)
-- New user submissions will have approval_status='pending'
