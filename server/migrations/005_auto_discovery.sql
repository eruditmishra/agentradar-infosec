-- ============================================================
-- 005_auto_discovery.sql
-- Auto Discovery Settings and Findings
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE, -- NULL for single-tenant
    auto_scan_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (auto_scan_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scan_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES discovery_scans(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES discovered_agents(id) ON DELETE CASCADE,
    finding_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'risk', 'critical')),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_findings_scan_id ON scan_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_findings_agent_id ON scan_findings(agent_id);
