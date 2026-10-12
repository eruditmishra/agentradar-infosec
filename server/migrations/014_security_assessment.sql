-- ============================================================
-- 014_security_assessment.sql
-- Multi-framework evidence-based agent assessment storage
-- (OWASP AI Agents 2026, NIST AI RMF, ISO/IEC 42001)
--
-- Two tables:
--   agent_security_assessments  – latest multi-framework assessment per agent
--   agent_security_drift        – change log between successive assessments
-- ============================================================

-- ── 1. agent_security_assessments ───────────────────────────
-- One row per agent (upserted each scan). Stores the full
-- normalized evidence + OWASP assessment + evidence completeness.
CREATE TABLE IF NOT EXISTS agent_security_assessments (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id              UUID        NOT NULL REFERENCES discovered_agents(id) ON DELETE CASCADE,
    tenant_id             UUID,
    schema_version        TEXT        NOT NULL DEFAULT '1.0',
    assessment_time       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Collector sources that contributed evidence
    evidence_sources      JSONB       NOT NULL DEFAULT '[]',

    -- Normalized evidence domains (identity, model, instructions, tools, etc.)
    domains               JSONB       NOT NULL DEFAULT '{}',

    -- Multi-framework control assessments, keyed by framework id
    -- (owasp_ai_agents_2026 | nist_ai_rmf | iso_42001), each value is
    -- { meta: FrameworkMeta, controls: Record<controlId, ControlAssessment> }
    frameworks            JSONB       NOT NULL DEFAULT '{}',

    -- Evidence completeness per domain (0.0–1.0) + overall
    evidence_completeness JSONB       NOT NULL DEFAULT '{}',

    -- Runtime test registry (typed stubs; populated when tests run)
    runtime_tests         JSONB       NOT NULL DEFAULT '[]',

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique per agent (+tenant), supports upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_sec_assessment_agent_tenant
    ON agent_security_assessments(agent_id, tenant_id)
    WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sec_assessment_agent_no_tenant
    ON agent_security_assessments(agent_id)
    WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sec_assessment_tenant
    ON agent_security_assessments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sec_assessment_time
    ON agent_security_assessments(assessment_time);

-- ── 2. agent_security_drift ─────────────────────────────────
-- Append-only log of security-relevant changes detected between
-- successive assessments. Supports drift detection / audit trail.
CREATE TABLE IF NOT EXISTS agent_security_drift (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id       UUID        NOT NULL REFERENCES discovered_agents(id) ON DELETE CASCADE,
    tenant_id      UUID,
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    scan_id        UUID        REFERENCES discovery_scans(id) ON DELETE SET NULL,

    -- e.g. "new_tool", "permission_escalation", "guardrail_removed", "model_changed"
    change_type    TEXT        NOT NULL,

    -- Human-readable summary of the change
    summary        TEXT        NOT NULL,

    -- Framework:control ids whose assessment may be affected by this change,
    -- e.g. "owasp_ai_agents_2026:AAI03", "nist_ai_rmf:GOVERN-2"
    affected_owasp TEXT[]      NOT NULL DEFAULT '{}',

    -- Snapshot of old vs new values
    previous_value JSONB,
    current_value  JSONB,

    -- Whether reassessment is required as a result of this change
    reassessment_required BOOLEAN NOT NULL DEFAULT true,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drift_agent     ON agent_security_drift(agent_id);
CREATE INDEX IF NOT EXISTS idx_drift_tenant    ON agent_security_drift(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drift_scan      ON agent_security_drift(scan_id);
CREATE INDEX IF NOT EXISTS idx_drift_type      ON agent_security_drift(change_type);
CREATE INDEX IF NOT EXISTS idx_drift_owasp     ON agent_security_drift USING GIN(affected_owasp);
