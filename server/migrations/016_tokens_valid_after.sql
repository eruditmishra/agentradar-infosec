-- ============================================================
-- Migration 016: Add tokens_valid_after to users
-- ============================================================
-- Access tokens are stateless JWTs with no server-side blacklist, so a
-- token issued before logout stays valid until its 15-minute TTL expires.
-- tokens_valid_after lets requireAuth() reject any access token whose
-- `iat` predates the user's last logout, closing that window without
-- needing a separate token-blacklist store.
-- ============================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ;

COMMIT;
