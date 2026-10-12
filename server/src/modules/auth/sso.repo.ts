import { db } from "../../db/client";
import { encryptSecrets, decryptSecrets } from "../../lib/encryption";

const ENCRYPTED_FIELD = "clientSecret";

/** Encrypts clientSecret in-place before it's persisted, if present. */
function encryptConfig(config: any): any {
  if (!config || typeof config !== "object" || !config[ENCRYPTED_FIELD]) {
    return config;
  }
  const { [ENCRYPTED_FIELD]: plainSecret, ...rest } = config;
  return {
    ...rest,
    [ENCRYPTED_FIELD]: encryptSecrets({ value: plainSecret })
  };
}

/** Decrypts clientSecret after reading from the DB, if present. */
function decryptConfig(config: any): any {
  if (!config || typeof config !== "object" || !config[ENCRYPTED_FIELD]) {
    return config;
  }
  try {
    const { value } = decryptSecrets(config[ENCRYPTED_FIELD]) as { value: string };
    return { ...config, [ENCRYPTED_FIELD]: value };
  } catch {
    // Not encrypted yet (pre-migration row) — return as-is.
    return config;
  }
}

export interface SSOConfiguration {
  id: string;
  tenant_id: string | null;
  provider_id: string;
  provider_type: 'oidc' | 'saml';
  config: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getActiveSSOConfig(tenantId: string | null): Promise<SSOConfiguration | null> {
  const res = tenantId
    ? await db.query(`SELECT * FROM sso_configurations WHERE tenant_id = $1 AND is_active = true LIMIT 1`, [tenantId])
    : await db.query(`SELECT * FROM sso_configurations WHERE tenant_id IS NULL AND is_active = true LIMIT 1`);
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, config: decryptConfig(row.config) };
}

export async function getSSOConfig(tenantId: string | null): Promise<SSOConfiguration | null> {
  const res = tenantId
    ? await db.query(`SELECT * FROM sso_configurations WHERE tenant_id = $1 LIMIT 1`, [tenantId])
    : await db.query(`SELECT * FROM sso_configurations WHERE tenant_id IS NULL LIMIT 1`);
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, config: decryptConfig(row.config) };
}

/** Same as getSSOConfig but skips decryption — used internally by upsert to diff against the still-encrypted stored row. */
async function getRawSSOConfig(tenantId: string | null): Promise<SSOConfiguration | null> {
  const res = tenantId
    ? await db.query(`SELECT * FROM sso_configurations WHERE tenant_id = $1 LIMIT 1`, [tenantId])
    : await db.query(`SELECT * FROM sso_configurations WHERE tenant_id IS NULL LIMIT 1`);
  return res.rows[0] ?? null;
}

export async function upsertSSOConfig(
  tenantId: string | null,
  providerId: string,
  providerType: 'oidc' | 'saml',
  config: any,
  isActive: boolean
): Promise<SSOConfiguration> {
  const existing = await getRawSSOConfig(tenantId);
  const encryptedConfig = encryptConfig(config);

  if (existing) {
    const res = await db.query(
      `UPDATE sso_configurations
       SET provider_id = $1, provider_type = $2, config = $3, is_active = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [providerId, providerType, encryptedConfig, isActive, existing.id]
    );
    return { ...res.rows[0], config: decryptConfig(res.rows[0].config) };
  } else {
    const res = await db.query(
      `INSERT INTO sso_configurations (tenant_id, provider_id, provider_type, config, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, providerId, providerType, encryptedConfig, isActive]
    );
    return { ...res.rows[0], config: decryptConfig(res.rows[0].config) };
  }
}
