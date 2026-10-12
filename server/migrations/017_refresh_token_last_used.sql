-- ============================================================
-- Migration 017: Add last_used_at to refresh_tokens
-- ============================================================
-- refresh() previously granted a fresh 15m access token + fresh 30d
-- refresh token on every call with no notion of real user inactivity,
-- so a session could be kept alive indefinitely by anything that kept
-- calling /api/auth/refresh. last_used_at lets refresh() reject a token
-- that hasn't been used in the last 15 minutes, enforcing a true idle
-- timeout instead of just an absolute 30-day cap.
-- ============================================================

BEGIN;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

UPDATE refresh_tokens
  SET last_used_at = created_at
  WHERE last_used_at IS NULL;

COMMIT;
