import { db } from "../../db/client";
import type {
  IntegrationConnection,
  IntegrationConnectionView,
  DecryptedIntegration,
  IntegrationProvider,
  IntegrationStatus,
} from "./integrations.types";

/** Safely parse a date string; returns null if falsy. */
function toDate(v: string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}

/** Return null when the value is undefined, otherwise return the value as-is. */
function n<T>(v: T | undefined): T | null {
  return v === undefined ? null : v;
}

export async function createIntegration(
  tenantId: string | null,
  input: {
    name: string;
    provider: IntegrationProvider;
    environment?: string;
    config: Record<string, unknown>;
    secretsEncrypted: string;
  }
): Promise<IntegrationConnection> {
  const res = await db.query(
    `INSERT INTO integration_connections (tenant_id, name, provider, environment, config, secrets_encrypted)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, name, provider, environment, config,
               status, last_tested_at, last_error, created_at, updated_at`,
    [
      tenantId,
      input.name,
      input.provider,
      input.environment ?? "production",
      JSON.stringify(input.config),
      input.secretsEncrypted,
    ],
  );
  return res.rows[0];
}

export async function updateIntegration(
  id: string,
  tenantId: string | null,
  input: {
    name: string;
    environment: string;
    config: Record<string, unknown>;
    secretsEncrypted: string;
  }
): Promise<IntegrationConnection | null> {
  const res = tenantId
    ? await db.query(
        `UPDATE integration_connections
         SET name = $3, environment = $4, config = $5, secrets_encrypted = $6, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, tenant_id, name, provider, environment, config,
                   status, last_tested_at, last_error, created_at, updated_at`,
        [id, tenantId, input.name, input.environment, JSON.stringify(input.config), input.secretsEncrypted],
      )
    : await db.query(
        `UPDATE integration_connections
         SET name = $2, environment = $3, config = $4, secrets_encrypted = $5, updated_at = now()
         WHERE id = $1 AND tenant_id IS NULL
         RETURNING id, tenant_id, name, provider, environment, config,
                   status, last_tested_at, last_error, created_at, updated_at`,
        [id, input.name, input.environment, JSON.stringify(input.config), input.secretsEncrypted],
      );
  return res.rows[0] ?? null;
}

export async function findIntegrationById(
  id: string,
  tenantId: string | null,
): Promise<IntegrationConnection | null> {
  const res = tenantId
    ? await db.query(
        `SELECT id, tenant_id, name, provider, environment, config,
                status, last_tested_at, last_error, created_at, updated_at
         FROM integration_connections WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      )
    : await db.query(
        `SELECT id, tenant_id, name, provider, environment, config,
                status, last_tested_at, last_error, created_at, updated_at
         FROM integration_connections WHERE id = $1 AND tenant_id IS NULL`,
        [id],
      );
  return res.rows[0] ?? null;
}

export async function findIntegrationWithSecrets(
  id: string,
  tenantId: string | null,
): Promise<IntegrationConnection & { secrets_encrypted: string } | null> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM integration_connections WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      )
    : await db.query(
        `SELECT * FROM integration_connections WHERE id = $1 AND tenant_id IS NULL`,
        [id],
      );
  return res.rows[0] ?? null;
}

export async function listIntegrations(
  tenantId: string | null,
  opts: {
    provider?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: IntegrationConnectionView[]; total: number }> {
  const conditions = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (tenantId) {
    conditions.push(`tenant_id = $${paramIdx++}`);
    params.push(tenantId);
  } else {
    conditions.push(`tenant_id IS NULL`);
  }

  if (opts.provider) {
    conditions.push(`provider = $${paramIdx++}`);
    params.push(opts.provider);
  }
  if (opts.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(opts.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const countRes = await db.query(
    `SELECT COUNT(*) FROM integration_connections ${whereClause}`,
    params,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const dataRes = await db.query(
    `SELECT id, name, provider, environment, config, status, last_tested_at, last_error, created_at, updated_at
     FROM integration_connections
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );

  return { items: dataRes.rows, total };
}

export async function updateIntegrationStatus(
  id: string,
  status: IntegrationStatus,
  lastError: string | null = null,
) {
  await db.query(
    `UPDATE integration_connections
     SET status = $2, last_tested_at = now(), last_error = $3, updated_at = now()
     WHERE id = $1`,
    [id, status, lastError],
  );
}

export async function deleteIntegration(
  id: string,
  tenantId: string | null,
): Promise<boolean> {
  const res = tenantId
    ? await db.query(
        `DELETE FROM integration_connections WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [id, tenantId],
      )
    : await db.query(
        `DELETE FROM integration_connections WHERE id = $1 AND tenant_id IS NULL RETURNING id`,
        [id],
      );
  return res.rowCount !== null && res.rowCount > 0;
}

export async function findActiveIntegrationsWithSecrets(
  tenantId: string | null,
): Promise<(IntegrationConnection & { secrets_encrypted: string })[]> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM integration_connections WHERE status = 'active' AND tenant_id = $1`,
        [tenantId],
      )
    : await db.query(
        `SELECT * FROM integration_connections WHERE status = 'active' AND tenant_id IS NULL`,
      );
  return res.rows;
}

export async function findIntegrationsByIdsWithSecrets(
  ids: string[],
  tenantId: string | null,
): Promise<(IntegrationConnection & { secrets_encrypted: string })[]> {
  if (ids.length === 0) return [];
  const res = tenantId
    ? await db.query(
        `SELECT * FROM integration_connections WHERE id = ANY($1) AND tenant_id = $2`,
        [ids, tenantId],
      )
    : await db.query(
        `SELECT * FROM integration_connections WHERE id = ANY($1) AND tenant_id IS NULL`,
        [ids],
      );
  return res.rows;
}
