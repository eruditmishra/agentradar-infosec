import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for connector secrets.
 *
 * Key:    DISCOVERY_ENCRYPTION_KEY env var — 64 hex chars (32 bytes).
 * Format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 *
 * The raw secrets object is NEVER written to the database.
 * Decrypted secrets live only in memory, scoped to a single scanner invocation.
 */

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12; // 96-bit IV — optimal for GCM
const TAG_BYTES = 16; // 128-bit auth tag

export function assertEncryptionKey(): void {
  const key = process.env.DISCOVERY_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "DISCOVERY_ENCRYPTION_KEY is required. " +
        "Generate with: openssl rand -hex 32",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "DISCOVERY_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes).",
    );
  }
}

function getKey(): Buffer {
  const hex = process.env.DISCOVERY_ENCRYPTION_KEY;
  if (!hex) throw new Error("DISCOVERY_ENCRYPTION_KEY is not set");
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plain secrets object to a safe ciphertext string for DB storage.
 */
export function encryptSecrets(secrets: Record<string, unknown>): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });

  const plaintext = JSON.stringify(secrets);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a ciphertext string back to the original secrets object.
 * Throws if the data is tampered (auth tag mismatch).
 */
export function decryptSecrets(encrypted: string): Record<string, unknown> {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed encrypted secrets — expected iv:authTag:ciphertext",
    );
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as Record<string, unknown>;
}
