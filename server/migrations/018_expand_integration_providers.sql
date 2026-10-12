-- ============================================================
-- Migration 018: Expand integration_connections provider check constraint
-- ============================================================
-- Adds support for CI/CD (jenkins, github_actions, gitlab_ci),
-- EDR / Endpoint (crowdstrike, defender, intune, cortex, cortex_xdr, netskope),
-- Containers (kubernetes, k8s), and SaaS (m365_copilot, salesforce, workday,
-- servicenow, openai) integrations.
-- ============================================================

BEGIN;

ALTER TABLE integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_provider_check;

ALTER TABLE integration_connections
  ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider IN (
    'aws', 'azure', 'gcp', 'github', 'gitlab',
    'jenkins', 'github_actions', 'gitlab_ci',
    'crowdstrike', 'defender', 'intune', 'cortex', 'cortex_xdr', 'netskope',
    'kubernetes', 'k8s',
    'm365_copilot', 'salesforce', 'workday', 'servicenow', 'openai', 'claude', 'sap',
    'sentinelone', 'splunk', 'sentinel', 'okta', 'entra', 'epic', 'cerner', 'jira', 'zscaler', 'palo_alto', 'slack', 'teams'
  ));

COMMIT;
