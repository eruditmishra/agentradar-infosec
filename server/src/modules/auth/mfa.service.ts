import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import * as qrcode from "qrcode";
import { encryptSecrets, decryptSecrets } from "../../lib/encryption";
import { hashToken } from "./auth.repo";
import * as repo from "./mfa.repo";

const BACKUP_CODE_COUNT = 10;
const ISSUER = "AgentRadar";

// Allow the token to be valid across one 30s step before/after the server's,
// tolerating minor clock drift between the server and the user's device.
const EPOCH_TOLERANCE: [number, number] = [30, 30];

async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE });
    return result.valid;
  } catch {
    // otplib throws (rather than returning valid:false) for malformed input —
    // wrong length, empty, or non-digit characters (e.g. a backup code, which
    // contains letters). Any of those just means "not a valid TOTP code".
    return false;
  }
}

function decryptSecret(encrypted: string): string {
  const { secret } = decryptSecrets(encrypted);
  return secret as string;
}

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString("hex"), // 10 hex chars, easy to type
  );
}

export async function generateEnrollment(userId: string, email: string) {
  const secret = generateSecret();
  await repo.storePendingSecret(userId, encryptSecrets({ secret }));

  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  return { otpauthUrl, qrCodeDataUrl };
}

export async function confirmEnrollment(userId: string, token: string) {
  const user = await repo.getMfaState(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.mfa_secret) throw new Error("MFA_SETUP_NOT_STARTED");

  const secret = decryptSecret(user.mfa_secret);
  const valid = await verifyTotp(token, secret);
  if (!valid) throw new Error("INVALID_MFA_CODE");

  const backupCodes = generateBackupCodes();
  const hashedCodes = backupCodes.map(hashToken);
  await repo.activateMfa(userId, hashedCodes);

  return { backupCodes };
}

export async function verifyChallenge(userId: string, token: string) {
  const user = await repo.getMfaState(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.mfa_enabled || !user.mfa_secret) throw new Error("MFA_NOT_ENABLED");

  const secret = decryptSecret(user.mfa_secret);
  if (await verifyTotp(token, secret)) {
    return { usedBackupCode: false };
  }

  const hashedInput = hashToken(token.trim());
  const backupCodes: string[] = user.mfa_backup_codes ?? [];
  if (backupCodes.includes(hashedInput)) {
    await repo.consumeBackupCode(
      userId,
      backupCodes.filter((c) => c !== hashedInput),
    );
    return { usedBackupCode: true };
  }

  throw new Error("INVALID_MFA_CODE");
}

export async function disableMfa(userId: string) {
  await repo.clearMfa(userId);
}

/** Marks a user as needing MFA without an existing enrollment — they'll be walked through setup on their next login. */
export async function requireMfaSetup(userId: string) {
  await repo.requireMfaSetup(userId);
}
