-- ============================================================
-- Migration 019: Account lockout for direct password login
-- ============================================================
-- Closes KPMG finding "No Account Lockout/Brute Force" (KPMGRQ-863317 #2).
-- IP-based rate limiting (express-rate-limit on /login) already exists but
-- does not stop a distributed or low-and-slow brute force against a single
-- account. This adds a per-account failure counter and a lockout window.
-- ============================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMIT;
