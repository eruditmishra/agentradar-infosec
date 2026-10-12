-- ============================================================
-- 004_init_audit_logs.sql
-- Audit module: structured business event log + system access log
-- ============================================================

-- ── 1. audit_logs ────────────────────────────────────────────
-- One row per meaningful business event (connector/agent/model/auth lifecycle).
-- Designed to power UI activity panels without further joins.
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID,
    user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
    user_email    TEXT,                   -- denormalized; survives user deletion
    ip_address    TEXT,
    user_agent    TEXT,

    -- Event identity
    event_type    TEXT        NOT NULL,   -- e.g. 'scan.completed', 'agent.status_changed'
    entity_type   TEXT        NOT NULL,   -- 'connector' | 'agent' | 'model' | 'scan' | 'user' | 'system'
    entity_id     TEXT,                   -- UUID of the affected record
    entity_name   TEXT,                   -- human-readable name (denormalized for display)

    -- Action & outcome
    action        TEXT        NOT NULL,   -- 'create' | 'update' | 'delete' | 'trigger' | 'approve' | 'flag' | 'shadow'
    status        TEXT        NOT NULL DEFAULT 'success'
                              CHECK (status IN ('success', 'failure', 'partial')),

    -- Display
    summary       TEXT,                   -- human-readable one-liner for activity panels

    -- Change tracking
    before        JSONB,                  -- key fields BEFORE the change (no secrets)
    after         JSONB,                  -- key fields AFTER the change (no secrets)
    metadata      JSONB,                  -- extra context (scan stats, error detail, etc.)

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time   ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_time     ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type    ON audit_logs(event_type, created_at DESC);

-- ── 2. system_access_logs ────────────────────────────────────
-- One row per HTTP request (API calls) and per client-side pageview beacon.
-- Provides full "every click" coverage when combined with the frontend beacon.
CREATE TABLE IF NOT EXISTS system_access_logs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID,
    user_id        UUID,
    user_email     TEXT,
    ip_address     TEXT,
    user_agent     TEXT,

    method         TEXT        NOT NULL,  -- GET / POST / PATCH / DELETE / PAGEVIEW
    path           TEXT        NOT NULL,  -- /api/discovery/scans  OR  /agents (frontend route)
    query_params   JSONB,                 -- parsed query string
    status_code    INT,                   -- HTTP status; NULL for PAGEVIEW
    duration_ms    INT,                   -- server processing time; NULL for PAGEVIEW
    request_size   INT,
    response_size  INT,

    error_code     TEXT,                  -- AppError.code if the request failed
    error_message  TEXT,
    metadata       JSONB,                 -- { referrer, type } for PAGEVIEW entries

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_syslog_tenant_time  ON system_access_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syslog_user_time    ON system_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syslog_path_time    ON system_access_logs(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syslog_method       ON system_access_logs(method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syslog_status       ON system_access_logs(status_code, created_at DESC);
