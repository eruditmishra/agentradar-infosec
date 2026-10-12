-- ============================================================
-- Migration 013: Backfill mfa_enabled for existing Super Admins
-- ============================================================
-- Migration 008 turned mfa_enabled on for super_admin rows that existed
-- at the time it ran, but any super_admin created since (e.g. via
-- `npm run seed:admin` before mfa_enabled defaulted to TRUE there) still
-- has it off. Super Admin must always require MFA — re-run the backfill
-- idempotently to catch those.
-- ============================================================

BEGIN;

UPDATE users
SET mfa_enabled = TRUE
WHERE role = 'super_admin'
  AND mfa_enabled = FALSE;

COMMIT;
