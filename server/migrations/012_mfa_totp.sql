-- ============================================================
-- Migration 012: MFA (TOTP) enrollment storage
-- ============================================================
-- Adds the columns needed to actually enforce the MFA that
-- migration 008 scaffolded (mfa_enabled). mfa_enabled remains the
-- single source of truth for "does this user need MFA" — these
-- columns hold the enrollment material once they've completed setup.
-- ============================================================

BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

-- mfa_secret is encrypted at rest (see server/src/lib/encryption.ts) and
-- mfa_backup_codes stores SHA-256 hashes only — never plaintext.

COMMIT;
