-- ============================================================
-- 006_auto_discovery_toggle.sql
-- Add is_enabled toggle to settings
-- ============================================================

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT false;
