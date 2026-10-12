// ─── audit.repo.ts ────────────────────────────────────────────────────────────
// Raw DB access for audit_logs and system_access_logs tables.

import { db } from "../../db/client";
import type {
  AuditEventInput,
  AuditLog,
  SystemAccessLog,
  UnifiedLog,
  ListAuditLogsOpts,
  ListAccessLogsOpts,
} from "./audit.types";

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

export async function insertAuditLog(event: AuditEventInput): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs
      (tenant_id, user_id, user_email, ip_address, user_agent,
       event_type, entity_type, entity_id, entity_name,
       action, status, summary, before, after, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      event.tenantId ?? null,
      event.userId ?? null,
      event.userEmail ?? null,
      event.ipAddress ?? null,
      event.userAgent ?? null,
      event.eventType,
      event.entityType,
      event.entityId ?? null,
      event.entityName ?? null,
      event.action,
      event.status ?? "success",
      event.summary ?? null,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    ],
  );
}

export async function listAuditLogs(
  tenantId: string | null,
  opts: ListAuditLogsOpts = {},
): Promise<AuditLog[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) {
    conds.push(`tenant_id = $${i++}`);
    params.push(tenantId);
  } else {
    conds.push(`tenant_id IS NULL`);
  }

  if (opts.entityType) { conds.push(`entity_type = $${i++}`); params.push(opts.entityType); }
  if (opts.entityId)   { conds.push(`entity_id   = $${i++}`); params.push(opts.entityId); }
  if (opts.userId)     { conds.push(`user_id     = $${i++}`); params.push(opts.userId); }
  if (opts.eventType)  { conds.push(`event_type  = $${i++}`); params.push(opts.eventType); }
  if (opts.since)      { conds.push(`created_at >= $${i++}`); params.push(opts.since); }
  if (opts.until)      { conds.push(`created_at <= $${i++}`); params.push(opts.until); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(opts.limit ?? 50, opts.offset ?? 0);

  const res = await db.query(
    `SELECT * FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params,
  );
  return res.rows;
}

export async function countAuditLogs(
  tenantId: string | null,
  opts: Omit<ListAuditLogsOpts, "limit" | "offset"> = {},
): Promise<number> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conds.push(`tenant_id = $${i++}`); params.push(tenantId); }
  else { conds.push(`tenant_id IS NULL`); }

  if (opts.entityType) { conds.push(`entity_type = $${i++}`); params.push(opts.entityType); }
  if (opts.entityId)   { conds.push(`entity_id   = $${i++}`); params.push(opts.entityId); }
  if (opts.userId)     { conds.push(`user_id     = $${i++}`); params.push(opts.userId); }
  if (opts.eventType)  { conds.push(`event_type  = $${i++}`); params.push(opts.eventType); }
  if (opts.since)      { conds.push(`created_at >= $${i++}`); params.push(opts.since); }
  if (opts.until)      { conds.push(`created_at <= $${i++}`); params.push(opts.until); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT COUNT(*)::int AS total FROM audit_logs ${where}`,
    params,
  );
  return res.rows[0]?.total ?? 0;
}

// ─── SYSTEM ACCESS LOGS ──────────────────────────────────────────────────────

export interface AccessLogInput {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  method: string;
  path: string;
  queryParams?: Record<string, unknown> | null;
  statusCode?: number | null;
  durationMs?: number | null;
  requestSize?: number | null;
  responseSize?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertAccessLog(log: AccessLogInput): Promise<void> {
  await db.query(
    `INSERT INTO system_access_logs
      (tenant_id, user_id, user_email, ip_address, user_agent,
       method, path, query_params, status_code, duration_ms,
       request_size, response_size, error_code, error_message, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      log.tenantId ?? null,
      log.userId ?? null,
      log.userEmail ?? null,
      log.ipAddress ?? null,
      log.userAgent ?? null,
      log.method,
      log.path,
      log.queryParams ? JSON.stringify(log.queryParams) : null,
      log.statusCode ?? null,
      log.durationMs ?? null,
      log.requestSize ?? null,
      log.responseSize ?? null,
      log.errorCode ?? null,
      log.errorMessage ?? null,
      log.metadata ? JSON.stringify(log.metadata) : null,
    ],
  );
}

export async function listAccessLogs(
  tenantId: string | null,
  opts: ListAccessLogsOpts = {},
): Promise<SystemAccessLog[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conds.push(`tenant_id = $${i++}`); params.push(tenantId); }
  else { conds.push(`tenant_id IS NULL`); }

  if (opts.userId) { conds.push(`user_id = $${i++}`); params.push(opts.userId); }
  if (opts.method) { conds.push(`method  = $${i++}`); params.push(opts.method.toUpperCase()); }
  if (opts.path)   { conds.push(`path ILIKE $${i++}`); params.push(`%${opts.path}%`); }
  if (opts.since)  { conds.push(`created_at >= $${i++}`); params.push(opts.since); }
  if (opts.until)  { conds.push(`created_at <= $${i++}`); params.push(opts.until); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(opts.limit ?? 100, opts.offset ?? 0);

  const res = await db.query(
    `SELECT * FROM system_access_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params,
  );
  return res.rows;
}

// ─── UNIFIED LOGS ────────────────────────────────────────────────────────────

export async function listUnifiedLogs(
  tenantId: string | null,
  opts: { limit?: number; offset?: number } = {}
): Promise<UnifiedLog[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) {
    conds.push(`tenant_id = $${i++}`);
    params.push(tenantId);
  } else {
    conds.push(`tenant_id IS NULL`);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(opts.limit ?? 100, opts.offset ?? 0);

  const query = `
    SELECT * FROM (
      SELECT 
        id, 
        'audit' AS log_type, 
        tenant_id, 
        user_email, 
        ip_address, 
        event_type, 
        entity_type, 
        entity_name, 
        summary, 
        created_at 
      FROM audit_logs
      ${where}
      
      UNION ALL
      
      SELECT 
        id, 
        'access' AS log_type, 
        tenant_id, 
        user_email, 
        ip_address, 
        method AS event_type, 
        'system' AS entity_type, 
        path AS entity_name, 
        CONCAT('[', method, '] ', path) AS summary, 
        created_at 
      FROM system_access_logs
      ${where}
    ) AS unified
    ORDER BY created_at DESC
    LIMIT $${i++} OFFSET $${i++}
  `;

  const res = await db.query(query, params);
  return res.rows;
}

export async function countUnifiedLogs(
  tenantId: string | null
): Promise<number> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) {
    conds.push(`tenant_id = $${i++}`);
    params.push(tenantId);
  } else {
    conds.push(`tenant_id IS NULL`);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const query = `
    SELECT 
      (SELECT COUNT(*) FROM audit_logs ${where}) + 
      (SELECT COUNT(*) FROM system_access_logs ${where}) 
    AS total_count
  `;

  const res = await db.query(query, params);
  return parseInt(res.rows[0].total_count, 10);
}
