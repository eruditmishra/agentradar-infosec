// ─── audit.types.ts ──────────────────────────────────────────────────────────
// Shared TypeScript types for the audit / activity-log module.

export type AuditEntityType =
  | "connector"
  | "agent"
  | "model"
  | "scan"
  | "user"
  | "system";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "trigger"
  | "approve"
  | "flag"
  | "shadow"
  | "login"
  | "logout"
  | "test"
  | "read";

export type AuditStatus = "success" | "failure" | "partial";

export interface AuditEventInput {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;

  eventType: string;           // e.g. 'scan.completed', 'agent.status_changed'
  entityType: AuditEntityType;
  entityId?: string | null;
  entityName?: string | null;

  action: AuditAction;
  status?: AuditStatus;        // defaults to 'success'
  summary?: string | null;

  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  event_type: string;
  entity_type: AuditEntityType;
  entity_id: string | null;
  entity_name: string | null;
  action: AuditAction;
  status: AuditStatus;
  summary: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface SystemAccessLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  method: string;
  path: string;
  query_params: Record<string, unknown> | null;
  status_code: number | null;
  duration_ms: number | null;
  request_size: number | null;
  response_size: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface UnifiedLog {
  id: string;
  log_type: "audit" | "access";
  tenant_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  event_type: string;
  entity_type: string;
  entity_name: string | null;
  summary: string | null;
  created_at: Date;
}

export interface ListAuditLogsOpts {
  entityType?: AuditEntityType;
  entityId?: string;
  userId?: string;
  eventType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface ListAccessLogsOpts {
  userId?: string;
  method?: string;
  path?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}
