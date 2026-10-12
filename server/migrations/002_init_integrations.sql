-- ============================================================
-- 002_init_integrations.sql
-- Integrations module: manages provider connections
-- ============================================================

-- ── 1. integration_connections ──────────────────────────────
-- One row per registered provider account/instance.
-- secrets_encrypted: AES-256-GCM ciphertext (never plain JSON)
CREATE TABLE IF NOT EXISTS integration_connections (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID,
    name              TEXT        NOT NULL,
    provider          TEXT        NOT NULL
                                  CHECK (provider IN ('aws','azure','gcp','github','gitlab')),
    environment       TEXT        NOT NULL DEFAULT 'production',
    config            JSONB       NOT NULL DEFAULT '{}',
    secrets_encrypted TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','inactive','error')),
    last_tested_at    TIMESTAMPTZ,
    last_error        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant_provider
    ON integration_connections(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status
    ON integration_connections(status);
