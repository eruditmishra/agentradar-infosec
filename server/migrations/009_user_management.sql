-- ============================================================
-- Migration 007: User Management POC
-- ============================================================
-- Expands the users table with fields required for the POC
-- user management capabilities.
-- ============================================================

BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Set a default name for existing users based on their email prefix
UPDATE users
SET name = split_part(email, '@', 1)
WHERE name IS NULL;

COMMIT;
