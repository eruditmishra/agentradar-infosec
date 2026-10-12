-- ============================================================
-- 015_security_assessment_frameworks.sql
-- Migrate agent_security_assessments from the OWASP-only
-- (owasp_llm, owasp_agentic) columns to the generic multi-framework
-- `frameworks` column (OWASP AI Agents 2026, NIST AI RMF, ISO/IEC 42001).
--
-- 014_security_assessment.sql already ran against this database with the
-- old column names before the multi-framework rework, so this migration
-- alters the live table rather than relying on CREATE TABLE IF NOT EXISTS.
-- ============================================================

ALTER TABLE agent_security_assessments
    ADD COLUMN IF NOT EXISTS frameworks JSONB NOT NULL DEFAULT '{}';

-- Old assessments used the retired OWASP LLM/Agentic split. Drop them —
-- they'll be recomputed against the new frameworks on next scan/refresh.
ALTER TABLE agent_security_assessments
    DROP COLUMN IF EXISTS owasp_llm,
    DROP COLUMN IF EXISTS owasp_agentic;
