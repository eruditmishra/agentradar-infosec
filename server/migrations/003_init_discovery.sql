-- ============================================================
-- 003_init_discovery.sql
-- Discovery module: scans, agents, models, logs
-- ============================================================

-- ── 2. discovery_scans ──────────────────────────────────────
-- One row per scan job; may target multiple integrations.
CREATE TABLE IF NOT EXISTS discovery_scans (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    integration_ids UUID[]      NOT NULL DEFAULT '{}',
    scan_all        BOOLEAN     NOT NULL DEFAULT false,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','running','completed','failed')),
    triggered_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    stats           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_tenant       ON discovery_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scans_status       ON discovery_scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_integrations ON discovery_scans USING GIN(integration_ids);

-- ── 3. scan_integrations (was scan_connectors) ──────────────
-- Per-integration progress within a scan (join table).
CREATE TABLE IF NOT EXISTS scan_integrations (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id          UUID        NOT NULL REFERENCES discovery_scans(id)  ON DELETE CASCADE,
    integration_id   UUID        NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
    provider         TEXT        NOT NULL,
    integration_name TEXT,
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','running','completed','failed')),
    agents_found     INT         NOT NULL DEFAULT 0,
    models_found     INT         NOT NULL DEFAULT 0,
    errors           JSONB       NOT NULL DEFAULT '[]',
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    UNIQUE (scan_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_integrations_scan        ON scan_integrations(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_integrations_integration ON scan_integrations(integration_id);

-- ── 4. discovered_agents ────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovered_agents (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID,
    scan_id                   UUID        REFERENCES discovery_scans(id)  ON DELETE SET NULL,
    integration_id            UUID        REFERENCES integration_connections(id) ON DELETE SET NULL,
    fingerprint               TEXT        NOT NULL,

    -- Identity & location
    name                      TEXT,
    owner                     TEXT,
    device                    TEXT,
    hostname                  TEXT,
    ip                        TEXT,
    operating_system          TEXT,
    department                TEXT,
    business_unit             TEXT,
    location                  TEXT,
    repository                TEXT,

    -- Agent identity
    framework                 TEXT,
    programming_language      TEXT,
    model                     TEXT,
    provider                  TEXT,
    version                   TEXT,
    deployment_type           TEXT,
    cloud_provider            TEXT,
    region                    TEXT,
    container                 TEXT,
    vm                        TEXT,
    endpoint                  TEXT,
    ide                       TEXT,

    -- Runtime
    running_status            TEXT,
    memory_usage_mb           NUMERIC,
    cpu_usage_pct             NUMERIC,
    execution_capability      TEXT,
    creation_time             TIMESTAMPTZ,
    last_modified             TIMESTAMPTZ,
    last_seen                 TIMESTAMPTZ,
    first_discovered          TIMESTAMPTZ,

    -- Security flags
    api_keys_detected         BOOLEAN     NOT NULL DEFAULT false,
    secrets_detected          BOOLEAN     NOT NULL DEFAULT false,
    internet_access           BOOLEAN     NOT NULL DEFAULT false,
    filesystem_access         BOOLEAN     NOT NULL DEFAULT false,
    database_access           BOOLEAN     NOT NULL DEFAULT false,
    github_access             BOOLEAN     NOT NULL DEFAULT false,
    slack_access              BOOLEAN     NOT NULL DEFAULT false,
    email_access              BOOLEAN     NOT NULL DEFAULT false,
    calendar_access           BOOLEAN     NOT NULL DEFAULT false,
    browser_access            BOOLEAN     NOT NULL DEFAULT false,

    -- Arrays / JSONB
    mcp_connections           JSONB       NOT NULL DEFAULT '[]',
    tools                     JSONB       NOT NULL DEFAULT '[]',
    prompt_templates          JSONB       NOT NULL DEFAULT '[]',
    connected_applications    JSONB       NOT NULL DEFAULT '[]',
    permissions               JSONB       NOT NULL DEFAULT '[]',
    risk_indicators           TEXT[]      NOT NULL DEFAULT '{}',
    source_collectors         TEXT[]      NOT NULL DEFAULT '{}',

    -- String scalars
    memory_store              TEXT,
    vector_database           TEXT,
    identity_used             TEXT,
    how_identified            TEXT,
    evidence_class            TEXT,
    evidence_reason           TEXT,
    category                  TEXT,
    confidence_score          NUMERIC,

    -- Status fields
    agent_status              TEXT,
    status                    TEXT        NOT NULL DEFAULT 'shadow'
                                          CHECK (status IN ('shadow','reviewed','approved','flagged')),

    -- JSONB blobs
    metadata                  JSONB,
    agent_config              JSONB,
    agent_access              JSONB,
    ownership                 JSONB,
    data_access_classification JSONB,
    mesh                      JSONB,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_tenant_fingerprint
    ON discovered_agents(tenant_id, fingerprint) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_fingerprint_no_tenant
    ON discovered_agents(fingerprint) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_agents_integration  ON discovered_agents(integration_id);
CREATE INDEX IF NOT EXISTS idx_agents_provider     ON discovered_agents(provider);
CREATE INDEX IF NOT EXISTS idx_agents_status       ON discovered_agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_agent_status ON discovered_agents(agent_status);
CREATE INDEX IF NOT EXISTS idx_agents_risk         ON discovered_agents USING GIN(risk_indicators);
CREATE INDEX IF NOT EXISTS idx_agents_scan         ON discovered_agents(scan_id);

-- ── 5. discovered_models ────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovered_models (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID,
    name              TEXT        NOT NULL,
    display_name      TEXT,
    provider          TEXT,
    model_type        TEXT        NOT NULL DEFAULT 'unknown'
                                  CHECK (model_type IN ('llm','embedding','classifier','image','multimodal','unknown')),
    version           TEXT,
    family            TEXT,
    validation_status TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (validation_status IN ('pending','approved','flagged','deprecated','under_review')),
    risk_level        TEXT        NOT NULL DEFAULT 'unknown'
                                  CHECK (risk_level IN ('low','medium','high','critical','unknown')),
    agent_count       INT         NOT NULL DEFAULT 0,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes             TEXT,
    reviewed_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMPTZ,
    capabilities      JSONB       NOT NULL DEFAULT '{}',
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_models_tenant_name_provider
    ON discovered_models(tenant_id, name, provider) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_name_provider_no_tenant
    ON discovered_models(name, provider) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_models_validation ON discovered_models(validation_status);
CREATE INDEX IF NOT EXISTS idx_models_risk        ON discovered_models(risk_level);
CREATE INDEX IF NOT EXISTS idx_models_provider    ON discovered_models(provider);

-- ── 6. agent_model_usage ────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_model_usage (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID        NOT NULL REFERENCES discovered_agents(id) ON DELETE CASCADE,
    model_id      UUID        NOT NULL REFERENCES discovered_models(id) ON DELETE CASCADE,
    usage_context TEXT        NOT NULL DEFAULT 'primary',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_model_usage_model ON agent_model_usage(model_id);

-- ── 7. scan_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id        UUID        NOT NULL REFERENCES discovery_scans(id)  ON DELETE CASCADE,
    integration_id UUID        REFERENCES integration_connections(id)   ON DELETE SET NULL,
    level          TEXT        NOT NULL DEFAULT 'info'
                               CHECK (level IN ('info','warn','error')),
    message        TEXT        NOT NULL,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs(scan_id);
