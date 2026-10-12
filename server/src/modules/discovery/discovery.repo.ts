import { db } from "../../db/client";
import { calculateAgentRiskScore } from "../security/riskScore";
import type {
  CloudConnector,
  CloudConnectorWithSecrets,
  ConnectorStatus,
  CreateConnectorInput,
  DiscoveredAgent,
  DiscoveredModel,
  DiscoveryScan,
  LogLevel,
  ModelValidationStatus,
  ModelRiskLevel,
  ModelType,
  ScanIntegrationRow,
  ScanLog,
  ScannerRawObservation,
  UpdateModelInput,
  UpdateAgentInput,
  AgentGovernanceStatus,
} from "./discovery.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely parse a date string; returns null if falsy. */
function toDate(v: string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}

/** Return null when the value is undefined, otherwise return the value as-is. */
function n<T>(v: T | undefined): T | null {
  return v === undefined ? null : v;
}

/** Returns all active connectors WITH secrets for scanning — never exposed to HTTP. */
export async function findActiveConnectors(
  tenantId: string | null,
): Promise<CloudConnectorWithSecrets[]> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM cloud_connectors WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId],
      )
    : await db.query(
        `SELECT * FROM cloud_connectors WHERE tenant_id IS NULL AND status = 'active'`,
      );
  return res.rows;
}

export async function findConnectorsByIds(
  ids: string[],
  tenantId: string | null,
): Promise<CloudConnectorWithSecrets[]> {
  if (!ids.length) return [];
  const res = tenantId
    ? await db.query(
        `SELECT * FROM cloud_connectors WHERE id = ANY($1) AND tenant_id = $2`,
        [ids, tenantId],
      )
    : await db.query(
        `SELECT * FROM cloud_connectors WHERE id = ANY($1) AND tenant_id IS NULL`,
        [ids],
      );
  return res.rows;
}

// ─── SCAN QUERIES ────────────────────────────────────────────────────────────

export async function createScan(
  tenantId: string | null,
  integrationIds: string[],
  scanAll: boolean,
  triggeredBy: string | null,
): Promise<DiscoveryScan> {
  const res = await db.query(
    `INSERT INTO discovery_scans (tenant_id, integration_ids, scan_all, triggered_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, integrationIds, scanAll, triggeredBy],
  );
  return res.rows[0];
}

export async function createScanIntegrationRows(
  scanId: string,
  connectors: Array<{ id: string; provider: string; name: string }>,
): Promise<void> {
  for (const c of connectors) {
    await db.query(
      `INSERT INTO scan_integrations (scan_id, integration_id, provider, integration_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scan_id, integration_id) DO NOTHING`,
      [scanId, c.id, c.provider, c.name],
    );
  }
}

export async function updateScanIntegrationStatus(
  scanId: string,
  integrationId: string,
  status: string,
  agentsFound?: number,
  modelsFound?: number,
  errors?: unknown[],
): Promise<void> {
  const now = new Date();
  await db.query(
    `UPDATE scan_integrations
     SET status       = $1,
         agents_found = COALESCE($2, agents_found),
         models_found = COALESCE($3, models_found),
         errors       = COALESCE($4::jsonb, errors),
         started_at   = CASE WHEN $1 = 'running'                    THEN $5 ELSE started_at  END,
         completed_at = CASE WHEN $1 IN ('completed','failed') THEN $5 ELSE completed_at END
     WHERE scan_id = $6 AND integration_id = $7`,
    [
      status,
      agentsFound ?? null,
      modelsFound ?? null,
      errors ? JSON.stringify(errors) : null,
      now,
      scanId,
      integrationId,
    ],
  );
}

export async function updateScanStatus(
  scanId: string,
  status: string,
  stats?: Record<string, unknown> | null,
  errorMessage?: string | null,
): Promise<void> {
  const now = new Date();
  await db.query(
    `UPDATE discovery_scans
     SET status        = $1,
         stats         = COALESCE($2::jsonb, stats),
         error_message = COALESCE($3, error_message),
         started_at    = CASE WHEN $1 = 'running'                    THEN $4 ELSE started_at  END,
         completed_at  = CASE WHEN $1 IN ('completed','failed') THEN $4 ELSE completed_at END
     WHERE id = $5`,
    [status, stats ? JSON.stringify(stats) : null, errorMessage ?? null, now, scanId],
  );
}

export async function findScanById(
  scanId: string,
  tenantId: string | null,
): Promise<DiscoveryScan | null> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM discovery_scans WHERE id = $1 AND tenant_id = $2`,
        [scanId, tenantId],
      )
    : await db.query(
        `SELECT * FROM discovery_scans WHERE id = $1 AND tenant_id IS NULL`,
        [scanId],
      );
  return res.rows[0] ?? null;
}

export async function listScans(
  tenantId: string | null,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<DiscoveryScan[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conds.push(`tenant_id = $${i++}`); params.push(tenantId); }
  else          { conds.push(`tenant_id IS NULL`); }
  if (opts.status) { conds.push(`status = $${i++}`); params.push(opts.status); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(opts.limit ?? 20, opts.offset ?? 0);

  const res = await db.query(
    `SELECT * FROM discovery_scans ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params,
  );
  return res.rows;
}

export async function getScanIntegrations(scanId: string): Promise<ScanIntegrationRow[]> {
  const res = await db.query(
    `SELECT * FROM scan_integrations WHERE scan_id = $1`,
    [scanId],
  );
  return res.rows;
}

// ─── SETTINGS & FINDINGS ──────────────────────────────────────────────────────

export async function getSettings(tenantId: string | null): Promise<{ is_enabled: boolean, auto_scan_frequency: string }> {
  const res = tenantId
    ? await db.query(`SELECT is_enabled, auto_scan_frequency FROM settings WHERE tenant_id = $1`, [tenantId])
    : await db.query(`SELECT is_enabled, auto_scan_frequency FROM settings WHERE tenant_id IS NULL`);
  return res.rows[0] || { is_enabled: false, auto_scan_frequency: 'daily' };
}

export async function upsertSettings(tenantId: string | null, is_enabled: boolean, frequency: string): Promise<void> {
  if (tenantId) {
    await db.query(
      `INSERT INTO settings (tenant_id, is_enabled, auto_scan_frequency) VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO UPDATE SET is_enabled = $2, auto_scan_frequency = $3, updated_at = now()`,
      [tenantId, is_enabled, frequency]
    );
  } else {
    const res = await db.query(`SELECT id FROM settings WHERE tenant_id IS NULL`);
    if (res.rows.length > 0) {
      await db.query(`UPDATE settings SET is_enabled = $1, auto_scan_frequency = $2, updated_at = now() WHERE tenant_id IS NULL`, [is_enabled, frequency]);
    } else {
      await db.query(`INSERT INTO settings (is_enabled, auto_scan_frequency) VALUES ($1, $2)`, [is_enabled, frequency]);
    }
  }
}

export async function insertScanFinding(
  scanId: string,
  agentId: string,
  findingType: string,
  severity: string,
  details: any
) {
  await db.query(
    `INSERT INTO scan_findings (scan_id, agent_id, finding_type, severity, details) VALUES ($1, $2, $3, $4, $5)`,
    [scanId, agentId, findingType, severity, JSON.stringify(details)]
  );
}

export async function getLatestAutoFindings(tenantId: string | null): Promise<any[]> {
  // Finds the latest auto scan (where action='auto' handled in DB or triggered_by IS NULL)
  // Actually, wait, `triggered_by IS NULL` might not be enough if there are other triggers, but right now auto scans have triggered_by=NULL.
  const scanRes = tenantId
    ? await db.query(`SELECT id FROM discovery_scans WHERE tenant_id = $1 AND triggered_by IS NULL ORDER BY created_at DESC LIMIT 1`, [tenantId])
    : await db.query(`SELECT id FROM discovery_scans WHERE tenant_id IS NULL AND triggered_by IS NULL ORDER BY created_at DESC LIMIT 1`);
  
  if (scanRes.rows.length === 0) return [];
  const scanId = scanRes.rows[0].id;
  
  const findingsRes = await db.query(
    `SELECT f.*, a.name as agent_name, a.provider as agent_provider 
     FROM scan_findings f 
     JOIN discovered_agents a ON f.agent_id = a.id 
     WHERE f.scan_id = $1 
     ORDER BY f.created_at DESC`,
    [scanId]
  );
  return findingsRes.rows;
}

export async function findScanFindingsByAgentId(agentId: string, tenantId: string | null): Promise<any[]> {
  const res = tenantId
    ? await db.query(
        `SELECT f.finding_type, f.severity, f.details, f.created_at
         FROM scan_findings f
         JOIN discovery_scans s ON f.scan_id = s.id
         WHERE f.agent_id = $1 AND s.tenant_id = $2
         ORDER BY f.created_at DESC`,
        [agentId, tenantId]
      )
    : await db.query(
        `SELECT f.finding_type, f.severity, f.details, f.created_at
         FROM scan_findings f
         JOIN discovery_scans s ON f.scan_id = s.id
         WHERE f.agent_id = $1 AND s.tenant_id IS NULL
         ORDER BY f.created_at DESC`,
        [agentId]
      );
  return res.rows;
}

export async function getLatestAutoScanTime(): Promise<Date | null> {
  const scanRes = await db.query(`SELECT created_at FROM discovery_scans WHERE triggered_by IS NULL ORDER BY created_at DESC LIMIT 1`);
  if (scanRes.rows.length === 0) return null;
  return scanRes.rows[0].created_at;
}

// ─── AGENT QUERIES ───────────────────────────────────────────────────────────

/**
 * Upsert a discovered agent observation.
 * On conflict: updates all technical fields, but PRESERVES governance `status`
 * and the original `first_discovered` timestamp.
 */
export async function upsertDiscoveredAgent(
  tenantId: string | null,
  scanId: string,
  integrationId: string,
  obs: ScannerRawObservation,
): Promise<DiscoveredAgent> {
  // Resolve JSONB blobs — prefer top-level, fall back to inside metadata
  const meta = obs.metadata ?? {};
  const agentConfig  = obs.agentConfig  ?? (meta.agentConfig  as Record<string, unknown> | undefined) ?? null;
  const agentAccess  = obs.agentAccess  ?? (meta.agentAccess  as Record<string, unknown> | undefined) ?? null;
  const ownershipObj = obs.ownership    ?? (meta.ownership    as Record<string, unknown> | undefined) ?? null;
  const dataAccess   = obs.dataAccessClassification ?? (meta.dataAccessClassification as Record<string, unknown> | undefined) ?? null;
  const meshObj      = obs.mesh         ?? (meta.mesh         as Record<string, unknown> | undefined) ?? null;

  // Resolve string scalars — prefer top-level, fall back to metadata
  const agentStatus   = obs.agentStatus   ?? (meta.agentStatus   as string | undefined) ?? null;
  const evidenceClass = obs.evidenceClass ?? (meta.evidenceClass as string | undefined) ?? null;
  const evidenceReason= obs.evidenceReason?? (meta.evidenceReason as string | undefined) ?? null;
  const howIdentified = obs.howIdentified ?? (meta.howIdentified  as string | undefined) ?? (meta.discoveryMode as string | undefined) ?? null;

  const params = [
    tenantId,                                                            // $1
    scanId,                                                              // $2
    integrationId,                                                         // $3
    obs.fingerprint,                                                     // $4
    n(obs.name),                                                         // $5
    n(obs.owner),                                                        // $6
    n(obs.device),                                                       // $7
    n(obs.hostname),                                                     // $8
    n(obs.ip),                                                           // $9
    n(obs.operating_system),                                             // $10
    n(obs.department),                                                   // $11
    n(obs.business_unit),                                                // $12
    n(obs.location),                                                     // $13
    n(obs.repository),                                                   // $14
    n(obs.framework),                                                    // $15
    n(obs.programming_language),                                         // $16
    n(obs.model),                                                        // $17
    n(obs.provider),                                                     // $18
    n(obs.version),                                                      // $19
    n(obs.deployment_type),                                              // $20
    n(obs.cloud_provider),                                               // $21
    n(obs.region),                                                       // $22
    n(obs.container),                                                    // $23
    n(obs.vm),                                                           // $24
    n(obs.endpoint),                                                     // $25
    n(obs.ide),                                                          // $26
    n(obs.running_status),                                               // $27
    obs.memory_usage_mb ?? null,                                         // $28
    obs.cpu_usage_pct ?? null,                                           // $29
    n(obs.execution_capability),                                         // $30
    toDate(obs.creation_time),                                           // $31
    toDate(obs.last_modified),                                           // $32
    toDate(obs.last_seen),                                               // $33
    toDate(obs.first_discovered),                                        // $34
    obs.api_keys_detected ?? false,                                      // $35
    obs.secrets_detected ?? false,                                       // $36
    obs.internet_access ?? false,                                        // $37
    obs.filesystem_access ?? false,                                      // $38
    obs.database_access ?? false,                                        // $39
    obs.github_access ?? false,                                          // $40
    obs.slack_access ?? false,                                           // $41
    obs.email_access ?? false,                                           // $42
    obs.calendar_access ?? false,                                        // $43
    obs.browser_access ?? false,                                         // $44
    JSON.stringify(obs.mcp_connections ?? []),                           // $45
    JSON.stringify(obs.tools ?? []),                                     // $46
    JSON.stringify(obs.prompt_templates ?? []),                          // $47
    JSON.stringify(obs.connected_applications ?? []),                    // $48
    JSON.stringify(obs.permissions ?? []),                               // $49
    obs.risk_indicators ?? [],                                           // $50
    obs.source_collectors ?? (obs.collector_id ? [obs.collector_id] : []), // $51
    n(obs.memory_store),                                                 // $52
    n(obs.vector_database),                                              // $53
    n(obs.identity_used),                                                // $54
    howIdentified,                                                       // $55
    evidenceClass,                                                       // $56
    evidenceReason,                                                      // $57
    agentStatus,                                                         // $58
    n(obs.category),                                                     // $59
    obs.confidence_score != null ? Number(obs.confidence_score) : null, // $60
    obs.metadata ? JSON.stringify(obs.metadata) : null,                  // $61
    agentConfig  ? JSON.stringify(agentConfig)  : null,                  // $62
    agentAccess  ? JSON.stringify(agentAccess)  : null,                  // $63
    ownershipObj ? JSON.stringify(ownershipObj) : null,                  // $64
    dataAccess   ? JSON.stringify(dataAccess)   : null,                  // $65
    meshObj      ? JSON.stringify(meshObj)      : null,                  // $66
  ];

  const INSERT_COLS = `
    tenant_id, scan_id, integration_id, fingerprint, name, owner, device, hostname, ip,
    operating_system, department, business_unit, location, repository, framework,
    programming_language, model, provider, version, deployment_type, cloud_provider,
    region, container, vm, endpoint, ide, running_status, memory_usage_mb, cpu_usage_pct,
    execution_capability, creation_time, last_modified, last_seen, first_discovered,
    api_keys_detected, secrets_detected, internet_access, filesystem_access,
    database_access, github_access, slack_access, email_access, calendar_access,
    browser_access, mcp_connections, tools, prompt_templates, connected_applications,
    permissions, risk_indicators, source_collectors, memory_store, vector_database,
    identity_used, how_identified, evidence_class, evidence_reason, agent_status,
    category, confidence_score, metadata, agent_config, agent_access, ownership,
    data_access_classification, mesh
  `;
  const INSERT_VALUES = Array.from({ length: 66 }, (_, i) => `$${i + 1}`).join(",");

  // On conflict: update all technical fields but PRESERVE status (governance) and first_discovered
  const UPDATE_SET = `
    scan_id = EXCLUDED.scan_id,
    integration_id = EXCLUDED.integration_id,
    name = EXCLUDED.name,
    owner = EXCLUDED.owner,
    device = EXCLUDED.device,
    hostname = EXCLUDED.hostname,
    ip = EXCLUDED.ip,
    operating_system = EXCLUDED.operating_system,
    department = EXCLUDED.department,
    business_unit = EXCLUDED.business_unit,
    location = EXCLUDED.location,
    repository = EXCLUDED.repository,
    framework = EXCLUDED.framework,
    programming_language = EXCLUDED.programming_language,
    model = EXCLUDED.model,
    provider = EXCLUDED.provider,
    version = EXCLUDED.version,
    deployment_type = EXCLUDED.deployment_type,
    cloud_provider = EXCLUDED.cloud_provider,
    region = EXCLUDED.region,
    container = EXCLUDED.container,
    vm = EXCLUDED.vm,
    endpoint = EXCLUDED.endpoint,
    ide = EXCLUDED.ide,
    running_status = EXCLUDED.running_status,
    memory_usage_mb = EXCLUDED.memory_usage_mb,
    cpu_usage_pct = EXCLUDED.cpu_usage_pct,
    execution_capability = EXCLUDED.execution_capability,
    last_modified = EXCLUDED.last_modified,
    last_seen = EXCLUDED.last_seen,
    first_discovered = COALESCE(discovered_agents.first_discovered, EXCLUDED.first_discovered),
    api_keys_detected = EXCLUDED.api_keys_detected,
    secrets_detected = EXCLUDED.secrets_detected,
    internet_access = EXCLUDED.internet_access,
    filesystem_access = EXCLUDED.filesystem_access,
    database_access = EXCLUDED.database_access,
    github_access = EXCLUDED.github_access,
    slack_access = EXCLUDED.slack_access,
    email_access = EXCLUDED.email_access,
    calendar_access = EXCLUDED.calendar_access,
    browser_access = EXCLUDED.browser_access,
    mcp_connections = EXCLUDED.mcp_connections,
    tools = EXCLUDED.tools,
    prompt_templates = EXCLUDED.prompt_templates,
    connected_applications = EXCLUDED.connected_applications,
    permissions = EXCLUDED.permissions,
    risk_indicators = EXCLUDED.risk_indicators,
    source_collectors = EXCLUDED.source_collectors,
    memory_store = EXCLUDED.memory_store,
    vector_database = EXCLUDED.vector_database,
    identity_used = EXCLUDED.identity_used,
    how_identified = EXCLUDED.how_identified,
    evidence_class = EXCLUDED.evidence_class,
    evidence_reason = EXCLUDED.evidence_reason,
    agent_status = EXCLUDED.agent_status,
    category = EXCLUDED.category,
    confidence_score = EXCLUDED.confidence_score,
    metadata = EXCLUDED.metadata,
    agent_config = EXCLUDED.agent_config,
    agent_access = EXCLUDED.agent_access,
    ownership = EXCLUDED.ownership,
    data_access_classification = EXCLUDED.data_access_classification,
    mesh = EXCLUDED.mesh,
    updated_at = now()
  `;

  // Use the correct partial index predicate for each tenant_id case
  const CONFLICT =
    tenantId
      ? `(tenant_id, fingerprint) WHERE tenant_id IS NOT NULL`
      : `(fingerprint) WHERE tenant_id IS NULL`;

  // Pre-fetch to compute diffs
  const existingRes = tenantId
    ? await db.query(`SELECT * FROM discovered_agents WHERE fingerprint = $1 AND tenant_id = $2`, [obs.fingerprint, tenantId])
    : await db.query(`SELECT * FROM discovered_agents WHERE fingerprint = $1 AND tenant_id IS NULL`, [obs.fingerprint]);
  const existing = existingRes.rows[0];

  const res = await db.query(
    `INSERT INTO discovered_agents (${INSERT_COLS})
     VALUES (${INSERT_VALUES})
     ON CONFLICT ${CONFLICT}
     DO UPDATE SET ${UPDATE_SET}
     RETURNING *`,
    params,
  );
  const agent = res.rows[0];

  // Compute Findings
  try {
    if (!existing) {
      await insertScanFinding(scanId, agent.id, "new_agent", "info", { name: agent.name, provider: agent.provider });
    } else {
      if (existing.model !== agent.model) {
        await insertScanFinding(scanId, agent.id, "model_changed", "critical", { old: existing.model, new: agent.model });
      }

      const checkArrayDiff = (oldArr: any, newArr: any) => JSON.stringify(oldArr) !== JSON.stringify(newArr);
      if (checkArrayDiff(existing.tools, agent.tools) || existing.database_access !== agent.database_access) {
        await insertScanFinding(scanId, agent.id, "tools_changed", "risk", { 
          old_tools: existing.tools, new_tools: agent.tools, 
          old_db: existing.database_access, new_db: agent.database_access 
        });
      }

      // Check Data Access Classification for PHI / PII
      const oldClassification = existing.data_access_classification || {};
      const newClassification = agent.data_access_classification || {};
      if (
        (!oldClassification.phi_access && newClassification.phi_access) ||
        (!oldClassification.pii_access && newClassification.pii_access)
      ) {
        await insertScanFinding(scanId, agent.id, "data_classification_changed", "critical", { 
          old: oldClassification, new: newClassification 
        });
      }

      // Secrets exposed
      if (
        (!existing.api_keys_detected && agent.api_keys_detected) || 
        (!existing.secrets_detected && agent.secrets_detected)
      ) {
        await insertScanFinding(scanId, agent.id, "secrets_exposed", "critical", { 
          api_keys: agent.api_keys_detected, secrets: agent.secrets_detected 
        });
      }

      // Access broadened
      if (
        (!existing.internet_access && agent.internet_access) ||
        (!existing.filesystem_access && agent.filesystem_access) ||
        (!existing.email_access && agent.email_access) ||
        (!existing.slack_access && agent.slack_access)
      ) {
        await insertScanFinding(scanId, agent.id, "access_broadened", "risk", { 
          internet: agent.internet_access, fs: agent.filesystem_access, email: agent.email_access, slack: agent.slack_access 
        });
      }
    }
  } catch (err: any) {
    console.error(`[discovery.repo] Failed to generate finding for agent ${agent.id}: ${err.message}`);
  }

  return agent;
}

export async function findAgentById(
  agentId: string,
  tenantId: string | null,
): Promise<DiscoveredAgent | null> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM discovered_agents WHERE id = $1 AND tenant_id = $2`,
        [agentId, tenantId],
      )
    : await db.query(
        `SELECT * FROM discovered_agents WHERE id = $1 AND tenant_id IS NULL`,
        [agentId],
      );
  return res.rows[0] ?? null;
}

/** Returns the existing agent row for a given fingerprint, or null if it is new. */
export async function findAgentByFingerprint(
  fingerprint: string,
  tenantId: string | null,
): Promise<{ id: string } | null> {
  const res = tenantId
    ? await db.query(
        `SELECT id FROM discovered_agents WHERE fingerprint = $1 AND tenant_id = $2 LIMIT 1`,
        [fingerprint, tenantId],
      )
    : await db.query(
        `SELECT id FROM discovered_agents WHERE fingerprint = $1 AND tenant_id IS NULL LIMIT 1`,
        [fingerprint],
      );
  return res.rows[0] ?? null;
}

export async function listDiscoveredAgents(
  tenantId: string | null,
  opts: {
    provider?: string;
    integrationId?: string;
    status?: string;
    agentStatus?: string;
    riskIndicator?: string;
    model?: string;
    owner?: string;
    type?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    /** true → only rows WITH a model (real agents); false → only rows WITHOUT a model (pure identities) */
    hasModel?: boolean;
    /** true → exclude records that are deployment_type=identity AND model IS NULL (pure service principals) */
    excludeIdentities?: boolean;
  } = {},
): Promise<{ agents: DiscoveredAgent[], total: number }> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conds.push(`da.tenant_id = $${i++}`); params.push(tenantId); }
  else          { conds.push(`da.tenant_id IS NULL`); }

  if (opts.provider)     { conds.push(`da.cloud_provider = $${i++}`); params.push(opts.provider); }
  if (opts.integrationId)  { conds.push(`da.integration_id = $${i++}`);  params.push(opts.integrationId); }
  if (opts.status) {
    const statuses = opts.status.split(',').map(s => s.trim());
    if (statuses.length > 1) {
      conds.push(`da.status = ANY($${i++})`);
      params.push(statuses);
    } else {
      conds.push(`da.status = $${i++}`);
      params.push(opts.status);
    }
  }
  if (opts.agentStatus)  { conds.push(`da.agent_status = $${i++}`);  params.push(opts.agentStatus); }
  if (opts.riskIndicator){ conds.push(`$${i++} = ANY(da.risk_indicators)`); params.push(opts.riskIndicator); }
  if (opts.model)        { conds.push(`da.model = $${i++}`);         params.push(opts.model); }
  if (opts.owner)        { conds.push(`da.owner = $${i++}`);         params.push(opts.owner); }
  if (opts.type)         { conds.push(`da.deployment_type = $${i++}`); params.push(opts.type); }
  // hasModel=true  → must have a model (real AI agent workload)
  // hasModel=false → must NOT have a model (pure identity / service principal)
  if (opts.hasModel === true)  { conds.push(`da.model IS NOT NULL AND da.model <> ''`); }
  if (opts.hasModel === false) { conds.push(`(da.model IS NULL OR da.model = '')`); }
  // excludeIdentities=true → exclude records that are (deployment_type='identity' AND model IS NULL)
  // This keeps all cloud agents (even those without a model) while dropping pure service principals
  if (opts.excludeIdentities === true) {
    conds.push(`NOT (da.deployment_type = 'identity' AND (da.model IS NULL OR da.model = ''))`);
  }
  
  if (opts.search) {
    const term = `%${opts.search}%`;
    conds.push(`(da.name ILIKE $${i} OR da.owner ILIKE $${i} OR da.model ILIKE $${i})`);
    params.push(term);
    i++;
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  
  // Get total count
  const countRes = await db.query(
    `SELECT COUNT(*) FROM discovered_agents da ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const isRiskSort = opts.sortBy === 'risk_score' || opts.sortBy === 'riskScore';
  const allowedSortFields = ['name', 'model', 'cloud_provider', 'owner', 'deployment_type', 'confidence_score', 'risk_score', 'riskScore', 'created_at', 'status'];
  const sortBy = allowedSortFields.includes(opts.sortBy || '') ? opts.sortBy : 'created_at';
  const sortOrder = opts.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const nullsSort = sortOrder === 'ASC' ? 'NULLS FIRST' : 'NULLS LAST';

  const pLimit = opts.limit ?? 50;
  const pOffset = opts.offset ?? 0;

  if (isRiskSort) {
    const allRes = await db.query(
      `SELECT da.*, asa.assessment_time, asa.domains, asa.frameworks, asa.evidence_completeness
       FROM discovered_agents da
       LEFT JOIN agent_security_assessments asa ON da.id = asa.agent_id
       ${where}
       ORDER BY da.created_at DESC, da.id DESC`,
      params,
    );

    const mapped = allRes.rows.map((row: any) => {
      const assessment = (row.assessment_time || row.domains || row.frameworks) ? {
        domains: row.domains,
        frameworks: row.frameworks,
        evidence_completeness: row.evidence_completeness,
      } : null;
      const riskScoreBreakdown = assessment ? calculateAgentRiskScore(row, assessment) : null;
      return {
        ...row,
        riskScoreBreakdown,
        risk_score: riskScoreBreakdown ? riskScoreBreakdown.finalScore : null,
      };
    });

    mapped.sort((a: any, b: any) => {
      const scoreA = a.risk_score;
      const scoreB = b.risk_score;
      if (scoreA === null && scoreB === null) return 0;
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      return opts.sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });

    const paginated = mapped.slice(pOffset, pOffset + pLimit);
    return { agents: paginated, total };
  }

  const res = await db.query(
    `SELECT da.*, asa.assessment_time, asa.domains, asa.frameworks, asa.evidence_completeness
     FROM discovered_agents da
     LEFT JOIN agent_security_assessments asa ON da.id = asa.agent_id
     ${where}
     ORDER BY da.${sortBy} ${sortOrder} ${nullsSort}, da.id DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, pLimit, pOffset],
  );

  const mapped = res.rows.map((row: any) => {
    const assessment = (row.assessment_time || row.domains || row.frameworks) ? {
      domains: row.domains,
      frameworks: row.frameworks,
      evidence_completeness: row.evidence_completeness,
    } : null;
    const riskScoreBreakdown = assessment ? calculateAgentRiskScore(row, assessment) : null;
    return {
      ...row,
      riskScoreBreakdown,
      risk_score: riskScoreBreakdown ? riskScoreBreakdown.finalScore : null,
    };
  });

  return { agents: mapped, total };
}

export async function getAgentFilters(tenantId: string | null) {
  const cond = tenantId ? `WHERE tenant_id = $1` : `WHERE tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];

  const modelsRes = await db.query(`SELECT DISTINCT model FROM discovered_agents ${cond} AND model IS NOT NULL ORDER BY model`, params);
  const providersRes = await db.query(`SELECT DISTINCT cloud_provider FROM discovered_agents ${cond} AND cloud_provider IS NOT NULL ORDER BY cloud_provider`, params);
  const ownersRes = await db.query(`SELECT DISTINCT owner FROM discovered_agents ${cond} AND owner IS NOT NULL ORDER BY owner`, params);
  const typesRes = await db.query(`SELECT DISTINCT deployment_type FROM discovered_agents ${cond} AND deployment_type IS NOT NULL ORDER BY deployment_type`, params);
  const statusesRes = await db.query(`SELECT DISTINCT status FROM discovered_agents ${cond} AND status IS NOT NULL ORDER BY status`, params);

  return {
    models: modelsRes.rows.map(r => r.model),
    providers: providersRes.rows.map(r => r.cloud_provider),
    owners: ownersRes.rows.map(r => r.owner),
    types: typesRes.rows.map(r => r.deployment_type),
    statuses: statusesRes.rows.map(r => r.status)
  };
}

export async function updateAgentGovernanceStatus(
  agentId: string,
  tenantId: string | null,
  status: AgentGovernanceStatus,
): Promise<DiscoveredAgent | null> {
  const res = tenantId
    ? await db.query(
        `UPDATE discovered_agents SET status = $1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [status, agentId, tenantId],
      )
    : await db.query(
        `UPDATE discovered_agents SET status = $1, updated_at = now()
         WHERE id = $2 AND tenant_id IS NULL RETURNING *`,
        [status, agentId],
      );
  return res.rows[0] ?? null;
}

export async function updateAgent(
  agentId: string,
  tenantId: string | null,
  updates: UpdateAgentInput,
): Promise<DiscoveredAgent | null> {
  const sets: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(updates.status);
  }
  if (updates.requested_status !== undefined) {
    sets.push(`requested_status = $${i++}`);
    values.push(updates.requested_status);
  }
  if (updates.previous_status !== undefined) {
    sets.push(`previous_status = $${i++}`);
    values.push(updates.previous_status);
  }
  if (updates.request_remark !== undefined) {
    sets.push(`request_remark = $${i++}`);
    values.push(updates.request_remark);
  }
  if (updates.approval_remark !== undefined) {
    sets.push(`approval_remark = $${i++}`);
    values.push(updates.approval_remark);
  }

  if (sets.length === 0) return null;

  sets.push(`updated_at = now()`);

  const setClause = sets.join(", ");
  values.push(agentId);
  const idIdx = i++;

  let query = "";
  if (tenantId) {
    values.push(tenantId);
    const tIdx = i++;
    query = `
      UPDATE discovered_agents 
      SET ${setClause}
      WHERE id = $${idIdx} AND tenant_id = $${tIdx}
      RETURNING *
    `;
  } else {
    query = `
      UPDATE discovered_agents 
      SET ${setClause}
      WHERE id = $${idIdx} AND tenant_id IS NULL
      RETURNING *
    `;
  }

  const res = await db.query(query, values);
  return res.rows[0] ?? null;
}

export async function getAgentsByScanId(
  scanId: string,
  tenantId: string | null,
): Promise<DiscoveredAgent[]> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM discovered_agents WHERE scan_id = $1 AND tenant_id = $2`,
        [scanId, tenantId],
      )
    : await db.query(
        `SELECT * FROM discovered_agents WHERE scan_id = $1 AND tenant_id IS NULL`,
        [scanId],
      );
  return res.rows;
}

// ─── MODEL QUERIES ───────────────────────────────────────────────────────────

/** Checks if a model already exists (for audit: new vs. updated). */
export async function findModelByNameProvider(
  tenantId: string | null,
  name: string,
  provider: string,
): Promise<{ id: string } | null> {
  const res = tenantId
    ? await db.query(
        `SELECT id FROM discovered_models WHERE name = $1 AND provider = $2 AND tenant_id = $3 LIMIT 1`,
        [name, provider, tenantId],
      )
    : await db.query(
        `SELECT id FROM discovered_models WHERE name = $1 AND provider = $2 AND tenant_id IS NULL LIMIT 1`,
        [name, provider],
      );
  return res.rows[0] ?? null;
}

export async function upsertDiscoveredModel(
  tenantId: string | null,
  input: { name: string; provider: string; modelType?: string; family?: string },
): Promise<DiscoveredModel> {
  const now = new Date();
  const conflictTarget = tenantId
    ? `(tenant_id, name, provider) WHERE tenant_id IS NOT NULL`
    : `(name, provider) WHERE tenant_id IS NULL`;

  const res = await db.query(
    `INSERT INTO discovered_models (tenant_id, name, provider, model_type, family, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT ${conflictTarget}
     DO UPDATE SET
       last_seen_at = EXCLUDED.last_seen_at,
       updated_at   = now()
     RETURNING *`,
    [
      tenantId,
      input.name,
      input.provider,
      input.modelType ?? "unknown",
      input.family ?? null,
      now,
    ],
  );
  return res.rows[0];
}

export async function upsertAgentModelUsage(
  agentId: string,
  modelId: string,
  usageContext: string,
): Promise<void> {
  await db.query(
    `INSERT INTO agent_model_usage (agent_id, model_id, usage_context, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (agent_id, model_id)
     DO UPDATE SET last_seen_at = now()`,
    [agentId, modelId, usageContext],
  );
}

export async function recalculateModelAgentCount(modelId: string): Promise<void> {
  await db.query(
    `UPDATE discovered_models
     SET agent_count = (SELECT COUNT(*) FROM agent_model_usage WHERE model_id = $1),
         updated_at  = now()
     WHERE id = $1`,
    [modelId],
  );
}

export async function findModelById(
  modelId: string,
  tenantId: string | null,
): Promise<DiscoveredModel | null> {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM discovered_models WHERE id = $1 AND tenant_id = $2`,
        [modelId, tenantId],
      )
    : await db.query(
        `SELECT * FROM discovered_models WHERE id = $1 AND tenant_id IS NULL`,
        [modelId],
      );
  return res.rows[0] ?? null;
}

export async function listDiscoveredModels(
  tenantId: string | null,
  opts: {
    provider?: string;
    validationStatus?: string;
    riskLevel?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ models: DiscoveredModel[], total: number }> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (tenantId) { conds.push(`tenant_id = $${i++}`); params.push(tenantId); }
  else          { conds.push(`tenant_id IS NULL`); }

  if (opts.provider)         { conds.push(`provider = $${i++}`);          params.push(opts.provider); }
  if (opts.validationStatus) { conds.push(`validation_status = $${i++}`); params.push(opts.validationStatus); }
  if (opts.riskLevel)        { conds.push(`risk_level = $${i++}`);        params.push(opts.riskLevel); }
  if (opts.search) {
    conds.push(`(name ILIKE $${i} OR display_name ILIKE $${i})`);
    params.push(`%${opts.search}%`);
    i++;
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  // Count query
  const countRes = await db.query(`SELECT COUNT(*) FROM discovered_models ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Sorting
  const sortMap: Record<string, string> = {
    name: "name",
    provider: "provider",
    validation_status: "validation_status",
    risk_level: "risk_level",
    agent_count: "agent_count",
    first_seen_at: "first_seen_at",
    last_seen_at: "last_seen_at",
  };
  const sortCol = opts.sortBy && sortMap[opts.sortBy] ? sortMap[opts.sortBy] : "agent_count";
  const sortDir = opts.sortOrder === "asc" ? "ASC" : "DESC";

  // Data query
  params.push(opts.limit ?? 50, opts.offset ?? 0);
  const res = await db.query(
    `SELECT * FROM discovered_models ${where}
     ORDER BY ${sortCol} ${sortDir} NULLS LAST, id ${sortDir}
     LIMIT $${i++} OFFSET $${i++}`,
    params,
  );

  return { models: res.rows, total };
}

export async function getModelFilters(tenantId: string | null): Promise<{
  providers: string[];
  statuses: string[];
  riskLevels: string[];
}> {
  const where = tenantId ? `WHERE tenant_id = $1` : `WHERE tenant_id IS NULL`;
  const params = tenantId ? [tenantId] : [];

  const [providerRes, statusRes, riskRes] = await Promise.all([
    db.query(`SELECT DISTINCT provider FROM discovered_models ${where} AND provider IS NOT NULL ORDER BY provider`, params),
    db.query(`SELECT DISTINCT validation_status FROM discovered_models ${where} ORDER BY validation_status`, params),
    db.query(`SELECT DISTINCT risk_level FROM discovered_models ${where} ORDER BY risk_level`, params),
  ]);

  return {
    providers: providerRes.rows.map(r => r.provider),
    statuses: statusRes.rows.map(r => r.validation_status),
    riskLevels: riskRes.rows.map(r => r.risk_level),
  };
}

export async function updateDiscoveredModel(
  modelId: string,
  tenantId: string | null,
  patch: UpdateModelInput & { reviewed_by?: string },
): Promise<DiscoveredModel | null> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let i = 1;

  if (patch.display_name !== undefined)      { sets.push(`display_name = $${i++}`);      params.push(patch.display_name); }
  if (patch.validation_status !== undefined) { sets.push(`validation_status = $${i++}`); params.push(patch.validation_status); }
  if (patch.risk_level !== undefined)        { sets.push(`risk_level = $${i++}`);         params.push(patch.risk_level); }
  if (patch.model_type !== undefined)        { sets.push(`model_type = $${i++}`);         params.push(patch.model_type); }
  if (patch.notes !== undefined)             { sets.push(`notes = $${i++}`);              params.push(patch.notes); }
  if (patch.requested_status !== undefined)  { sets.push(`requested_status = $${i++}`);   params.push(patch.requested_status); }
  if (patch.previous_status !== undefined)   { sets.push(`previous_status = $${i++}`);    params.push(patch.previous_status); }
  if (patch.reviewed_by !== undefined) {
    sets.push(`reviewed_by = $${i++}`, `reviewed_at = now()`);
    params.push(patch.reviewed_by);
  }

  params.push(modelId);
  const idPh = `$${i++}`;
  const tenantFilter = tenantId ? ` AND tenant_id = $${i++}` : ` AND tenant_id IS NULL`;
  if (tenantId) params.push(tenantId);

  const res = await db.query(
    `UPDATE discovered_models SET ${sets.join(", ")}
     WHERE id = ${idPh}${tenantFilter}
     RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

export async function getAgentsForModel(
  modelId: string,
  tenantId: string | null,
  limit = 20,
): Promise<DiscoveredAgent[]> {
  const res = await db.query(
    `SELECT da.* FROM discovered_agents da
     JOIN agent_model_usage amu ON amu.agent_id = da.id
     WHERE amu.model_id = $1
     ${tenantId ? "AND da.tenant_id = $2" : "AND da.tenant_id IS NULL"}
     ORDER BY amu.last_seen_at DESC
     LIMIT ${tenantId ? "$3" : "$2"}`,
    tenantId ? [modelId, tenantId, limit] : [modelId, limit],
  );
  return res.rows;
}

// ─── LOG QUERIES ─────────────────────────────────────────────────────────────

export async function createScanLog(
  scanId: string,
  level: LogLevel,
  message: string,
  integrationId?: string,
  metadata?: Record<string, unknown>,
): Promise<ScanLog> {
  const res = await db.query(
    `INSERT INTO scan_logs (scan_id, integration_id, level, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [scanId, integrationId ?? null, level, message, metadata ? JSON.stringify(metadata) : null],
  );
  return res.rows[0];
}

export async function listScanLogs(
  scanId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ScanLog[]> {
  const res = await db.query(
    `SELECT * FROM scan_logs WHERE scan_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [scanId, opts.limit ?? 100, opts.offset ?? 0],
  );
  return res.rows;
}
