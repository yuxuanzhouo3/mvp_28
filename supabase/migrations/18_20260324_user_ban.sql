-- Migration: Add is_banned column to users table
-- Purpose: Enable admin user ban/unban functionality

-- Add is_banned column with default false
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Create index for efficient ban status filtering
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned) WHERE is_banned = true;
