-- ============================================================
-- Migration 001: RBAC Role Normalization + Auth Method
-- ============================================================
-- Run this once against the production database before deploying
-- the RBAC feature branch.
--
-- Changes:
--   1. Drop existing role CHECK constraint (allows only old role names)
--   2. Rename role values to new canonical snake_case names
--   3. Add new CHECK constraint with new role names
--   4. Add auth_method column to users
--   5. Add mfa_enabled column to users (for future MFA enforcement)
--   6. Mark existing SSO users with correct auth_method
-- ============================================================

BEGIN;

-- ─── 1. Drop existing role CHECK constraint ───────────────────────────────────
-- The old constraint only allows: 'admin', 'auditor', 'analyst', 'super-admin'
-- We need to rename these, so the constraint must be removed first.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- ─── 2. Rename existing role values ──────────────────────────────────────────

-- Old: 'super-admin'  → New: 'super_admin'
UPDATE users
SET role = 'super_admin'
WHERE role = 'super-admin';

-- Old: 'analyst'  → New: 'security_analyst'
UPDATE users
SET role = 'security_analyst'
WHERE role = 'analyst';

-- Old: 'admin' stays 'admin' (no change needed)
-- Old: 'auditor' stays 'auditor' (no change needed)

-- ─── 3. Add new CHECK constraint with the new role names ─────────────────────

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role = ANY (ARRAY[
  'super_admin',
  'admin',
  'ciso',
  'security_analyst',
  'auditor'
]));

-- ─── 4. Add auth_method column ────────────────────────────────────────────────
-- Tracks how a user authenticates: 'password' | 'sso' | 'microsoft'
-- Default is 'password' for existing users; SSO users are updated below.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) NOT NULL DEFAULT 'password',
ADD COLUMN IF NOT EXISTS microsoft_oid TEXT UNIQUE;

-- Mark existing SSO users (identified by their password_hash sentinel value)
UPDATE users
SET auth_method = 'sso'
WHERE password_hash = 'sso_no_password';

-- Mark existing Microsoft SSO users (those with a microsoft_oid)
UPDATE users
SET auth_method = 'microsoft'
WHERE microsoft_oid IS NOT NULL
  AND auth_method = 'password'; -- Don't overwrite if already set

-- ─── 5. Add mfa_enabled column ───────────────────────────────────────────────
-- Controls whether Platform-Level MFA is enforced for this user.
-- Currently defaulted to false (MFA check is skipped globally via env flag).
-- When MFA is enabled, super_admin users will be required to complete
-- Platform-Level MFA after password authentication.
--
-- NOTE: This column stores per-user MFA configuration.
--       The global on/off switch is the MFA_ENFORCEMENT_ENABLED environment variable.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Super Admin accounts should have MFA enabled by default once MFA is implemented.
UPDATE users
SET mfa_enabled = TRUE
WHERE role = 'super_admin';

-- ─── Verification queries (safe to run manually after migration) ──────────────
-- SELECT role, auth_method, mfa_enabled, COUNT(*) FROM users GROUP BY role, auth_method, mfa_enabled;

COMMIT;
