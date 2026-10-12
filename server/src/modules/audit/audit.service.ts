// ─── audit.service.ts ─────────────────────────────────────────────────────────
// Public interface for the audit system. All writes are fire-and-forget so
// they never block the primary request path.

import { logger } from "../../shared/logger";
import * as repo from "./audit.repo";
import type {
  AuditEventInput,
  ListAuditLogsOpts,
  ListAccessLogsOpts,
} from "./audit.types";
import type { AccessLogInput } from "./audit.repo";

// ─── Business event log ───────────────────────────────────────────────────────

/**
 * Write an audit log entry. Fire-and-forget — never awaited by callers.
 * A write failure is logged at warn level and silently swallowed so that
 * a misconfigured DB never causes a business operation to fail.
 */
export function log(event: AuditEventInput): void {
  repo
    .insertAuditLog(event)
    .catch((err) =>
      logger.warn({ err, eventType: event.eventType }, "audit log write failed"),
    );
}

export async function listLogs(tenantId: string | null, opts: ListAuditLogsOpts = {}) {
  const [logs, total] = await Promise.all([
    repo.listAuditLogs(tenantId, opts),
    repo.countAuditLogs(tenantId, opts),
  ]);
  return { logs, total };
}

// ─── System access log ────────────────────────────────────────────────────────

/**
 * Write a system access log entry. Fire-and-forget.
 */
export function logAccess(entry: AccessLogInput): void {
  repo
    .insertAccessLog(entry)
    .catch((err) =>
      logger.warn({ err }, "system access log write failed"),
    );
}

export async function listAccessLogs(
  tenantId: string | null,
  opts: ListAccessLogsOpts = {},
) {
  return repo.listAccessLogs(tenantId, opts);
}
