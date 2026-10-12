import { db } from "../../db/client";

export async function getMfaState(userId: string) {
  const res = await db.query(
    `SELECT id, email, mfa_enabled, mfa_secret, mfa_backup_codes, mfa_enrolled_at
     FROM users WHERE id = $1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

/** Stores a freshly generated TOTP secret without yet enabling MFA — enabling happens on confirmEnrollment(). */
export async function storePendingSecret(userId: string, encryptedSecret: string) {
  await db.query(
    `UPDATE users SET mfa_secret = $2, updated_at = now() WHERE id = $1`,
    [userId, encryptedSecret],
  );
}

export async function activateMfa(userId: string, hashedBackupCodes: string[]) {
  await db.query(
    `UPDATE users
     SET mfa_enabled = TRUE, mfa_backup_codes = $2, mfa_enrolled_at = now(), updated_at = now()
     WHERE id = $1`,
    [userId, hashedBackupCodes],
  );
}

export async function consumeBackupCode(userId: string, remainingHashedCodes: string[]) {
  await db.query(
    `UPDATE users SET mfa_backup_codes = $2, updated_at = now() WHERE id = $1`,
    [userId, remainingHashedCodes],
  );
}

export async function clearMfa(userId: string) {
  await db.query(
    `UPDATE users
     SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_enrolled_at = NULL, updated_at = now()
     WHERE id = $1`,
    [userId],
  );
}

/** Flags a user as requiring MFA setup without generating a secret yet — the user completes setup on next login. */
export async function requireMfaSetup(userId: string) {
  await db.query(
    `UPDATE users
     SET mfa_enabled = TRUE, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_enrolled_at = NULL, updated_at = now()
     WHERE id = $1`,
    [userId],
  );
}
