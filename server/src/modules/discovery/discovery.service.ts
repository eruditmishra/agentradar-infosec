/**
 * discovery.service.ts
 *
 * Orchestrates connector management, scan execution, and model extraction.
 *
 * Scan lifecycle:
 *   startScan → creates DB records → fires runScan in background (setImmediate)
 *   runScan   → parallel per-connector → upsert agents → extractAndUpsertModels
 *
 * Secrets are decrypted in-memory only inside runConnectorScan and immediately
 * discarded — never returned from any exported function.
 */

import { encryptSecrets, decryptSecrets } from "../../lib/encryption";
import {
  NotFoundError,
  BadRequestError,
  ValidationError,
} from "../../shared/errors";
import * as repo from "./discovery.repo";
import { getSecurityAssessment } from "../security/security.repo";
import { calculateAgentRiskScore } from "../security/riskScore";
import * as audit from "../audit/audit.service";
import { assessAndStore as securityAssessAndStore } from "../security/security.service";
import type {
  CloudConnector,
  CloudConnectorWithSecrets,
  CreateConnectorInput,
  DiscoveredAgent,
  DiscoveredModel,
  DiscoveryScan,
  ScanLog,
  ScannerRawObservation,
  StartScanInput,
  UpdateConnectorInput,
  UpdateModelInput,
  AgentGovernanceStatus,
  ModelValidationStatus,
  ScanProvider,
  ScanStats,
} from "./discovery.types";


// ─── Provider validators (from scanners) ─────────────────────────────────────
// These are lazily loaded so missing scanner utility deps don't break startup.

async function loadScanner(provider: ScanProvider) {
  try {
    switch (provider) {
      case "aws":
        return await import("./scanners/aws/aws.scanner");
      case "azure":
        return await import("./scanners/azure/azure.scanner");
      case "gcp":
        return await import("./scanners/gcp/gcp.scanner");
      case "github":
      case "gitlab":
        return await import("./scanners/git/git.scanner");
      case "jenkins":
      case "github_actions":
      case "gitlab_ci":
        return await import("./scanners/ci/ci.scanner");
      case "crowdstrike":
      case "defender":
      case "intune":
      case "cortex":
      case "cortex_xdr":
      case "netskope":
        return await import("./scanners/edr/edr.scanner");
      case "kubernetes":
      case "k8s":
        return await import("./scanners/k8s/k8s.scanner");
      case "m365_copilot":
      case "salesforce":
      case "workday":
      case "servicenow":
      case "openai":
        return await import("./scanners/saas/saas.scanner");
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (err: any) {
    throw new Error(
      `Scanner module for '${provider}' failed to load: ${err.message}. ` +
        `Ensure scanner utility files (http, aiRelevance, cloudDiscoveryCommon) exist.`,
    );
  }
}

import * as integrationsService from "../integrations/integrations.service";

// ─── SETTINGS & FINDINGS ──────────────────────────────────────────────────────

export async function getSettings(tenantId: string | null) {
  return repo.getSettings(tenantId);
}

export async function upsertSettings(tenantId: string | null, is_enabled: boolean, frequency: string) {
  return repo.upsertSettings(tenantId, is_enabled, frequency);
}

export async function getLatestAutoFindings(tenantId: string | null) {
  return repo.getLatestAutoFindings(tenantId);
}

// ─── SCAN LOGIC ────────────────────────────────────────────────────────────────

export async function startScan(
  tenantId: string | null,
  input: StartScanInput,
  triggeredBy: string | null,
  triggeredByEmail?: string | null,
  isAuto: boolean = false,
): Promise<{ scanId: string }> {
  if (
    !input.scan_all &&
    (!input.integration_ids || !input.integration_ids.length)
  ) {
    throw new BadRequestError(
      "Provide either integration_ids or set scan_all: true",
    );
  }

  // Resolve integrations
  let integrations;
  if (input.scan_all) {
    integrations =
      await integrationsService.getActiveDecryptedIntegrations(tenantId);
    if (!integrations.length) {
      throw new BadRequestError("No active integrations found for this tenant");
    }
  } else {
    integrations = await integrationsService.getDecryptedIntegrationsByIds(
      input.integration_ids!,
      tenantId,
    );
    const foundIds = new Set(integrations.map((c) => c.id));
    const missing = input.integration_ids!.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new NotFoundError(
        `Integration(s) not found: ${missing.join(", ")}`,
      );
    }
  }

  const integrationIds = integrations.map((c) => c.id);
  const scan = await repo.createScan(
    tenantId,
    integrationIds,
    input.scan_all ?? false,
    triggeredBy,
  );
  await repo.createScanIntegrationRows(
    scan.id,
    integrations.map((c) => ({ id: c.id, provider: c.provider, name: c.name })),
  );

  // Audit: scan triggered
  const integrationNames = integrations.map((c) => c.name);
  const eventTypeStr = isAuto ? "scan.auto_started" : "scan.triggered";
  audit.log({
    tenantId,
    userId: triggeredBy,
    userEmail: triggeredByEmail,
    eventType: eventTypeStr as any,
    entityType: "scan",
    entityId: scan.id,
    entityName: `Scan across ${integrations.length} integration(s)`,
    action: isAuto ? "auto" as any : "trigger",
    summary: `${isAuto ? "Automated Scheduler" : (triggeredByEmail ?? "system")} triggered a scan across: ${integrationNames.join(", ")}`,
    after: {
      scan_id: scan.id,
      integrations: integrationNames,
      scan_all: input.scan_all ?? false,
    },
  });

  // Fire scan in background — do not await
  setImmediate(() => {
    runScan(scan.id, integrations as any, tenantId, triggeredBy, triggeredByEmail ?? null, isAuto).catch((err) => {
      console.error(`[discovery] runScan ${scan.id} crashed:`, err);
    });
  });

  return { scanId: scan.id };
}

export async function getScan(
  scanId: string,
  tenantId: string | null,
): Promise<
  DiscoveryScan & {
    integrations: ReturnType<typeof repo.getScanIntegrations> extends Promise<
      infer T
    >
      ? T
      : never;
  }
> {
  const scan = await repo.findScanById(scanId, tenantId);
  if (!scan) throw new NotFoundError("Scan not found");
  const integrations = await repo.getScanIntegrations(scanId);
  const rawAgents = await repo.getAgentsByScanId(scanId, tenantId);
  const agents = rawAgents.map(formatAgentResponse);
  return { ...scan, integrations, agents } as any;
}

export async function listScans(
  tenantId: string | null,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<DiscoveryScan[]> {
  return repo.listScans(tenantId, opts);
}

export async function getScanLogs(
  scanId: string,
  tenantId: string | null,
  opts: { limit?: number; offset?: number } = {},
): Promise<ScanLog[]> {
  // Verify scan belongs to tenant
  const scan = await repo.findScanById(scanId, tenantId);
  if (!scan) throw new NotFoundError("Scan not found");
  return repo.listScanLogs(scanId, opts);
}

export async function addScanLog(
  scanId: string,
  tenantId: string | null,
  level: "info" | "warn" | "error",
  message: string,
  integrationId?: string,
  metadata?: Record<string, unknown>,
): Promise<ScanLog> {
  const scan = await repo.findScanById(scanId, tenantId);
  if (!scan) throw new NotFoundError("Scan not found");
  return repo.createScanLog(scanId, level, message, integrationId, metadata);
}

// ─── AGENT OPERATIONS ────────────────────────────────────────────────────────

export async function listAgents(
  tenantId: string | null,
  opts: any,
) {
  const result = await repo.listDiscoveredAgents(tenantId, opts);
  return {
    agents: result.agents.map((agent: any) => {
      let riskScoreBreakdown = agent.riskScoreBreakdown;
      if (riskScoreBreakdown === undefined) {
        const assessment = (agent.assessment_time || agent.domains || agent.frameworks) ? {
          domains: agent.domains,
          frameworks: agent.frameworks,
          evidence_completeness: agent.evidence_completeness,
        } : null;
        riskScoreBreakdown = assessment ? calculateAgentRiskScore(agent, assessment) : null;
      }
      const formatted = formatAgentResponse(agent);
      delete (formatted as any).domains;
      delete (formatted as any).frameworks;
      delete (formatted as any).evidence_completeness;
      delete (formatted as any).assessment_time;
      return {
        ...formatted,
        riskScoreBreakdown,
        risk_score: riskScoreBreakdown ? riskScoreBreakdown.finalScore : (agent.risk_score ?? null),
      };
    }),
    total: result.total
  };
}

export async function getAgentFilters(tenantId: string | null) {
  return repo.getAgentFilters(tenantId);
}

export async function getAgent(agentId: string, tenantId: string | null) {
  const agent = await repo.findAgentById(agentId, tenantId);
  if (!agent) {
    throw new NotFoundError("Agent not found");
  }
  const findings = await repo.findScanFindingsByAgentId(agentId, tenantId);
  const assessment = await getSecurityAssessment(agentId, tenantId);
  let riskScoreBreakdown = null;
  if (assessment) {
    riskScoreBreakdown = calculateAgentRiskScore(agent, assessment);
  }
  return {
    ...formatAgentResponse(agent),
    findings,
    riskScoreBreakdown,
    risk_score: riskScoreBreakdown ? riskScoreBreakdown.finalScore : null,
  };
}

export function formatAgentResponse(agent: any) {
  const {
    agent_config,
    agent_access,
    ownership,
    data_access_classification,
    mesh,
    how_identified,
    evidence_class,
    evidence_reason,
    agent_status,
    ...rest
  } = agent;
  return {
    ...rest,
    agentConfig: agent_config,
    agentAccess: agent_access,
    ownership,
    dataAccessClassification: data_access_classification,
    mesh,
    howIdentified: how_identified,
    evidenceClass: evidence_class,
    evidenceReason: evidence_reason,
    agentStatus: agent_status,
  };
}

export async function updateAgentStatus(
  agentId: string,
  tenantId: string | null,
  status: AgentGovernanceStatus,
  actor?: { userId?: string | null; userEmail?: string | null },
): Promise<DiscoveredAgent> {
  const existing = await repo.findAgentById(agentId, tenantId);
  const updated = await repo.updateAgentGovernanceStatus(
    agentId,
    tenantId,
    status,
  );
  if (!updated) throw new NotFoundError("Agent not found");

  const agentName = updated.name ?? agentId;
  const prevStatus = existing?.status ?? null;
  audit.log({
    tenantId,
    userId: actor?.userId,
    userEmail: actor?.userEmail,
    eventType: "agent.status_changed",
    entityType: "agent",
    entityId: agentId,
    entityName: agentName,
    action: status === "approved" ? "approve" : status === "flagged" ? "flag" : status === "shadow" ? "shadow" : "update",
    status: "success",
    summary: `${actor?.userEmail ?? "system"} moved agent '${agentName}' from ${prevStatus} → ${status}`,
    before: { governance_status: prevStatus },
    after: { governance_status: status },
  });

  return updated;
}

// ─── MODEL OPERATIONS ────────────────────────────────────────────────────────

export async function listModels(
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
  return repo.listDiscoveredModels(tenantId, opts);
}

export async function getModelFilters(tenantId: string | null) {
  return repo.getModelFilters(tenantId);
}

export async function getModel(
  modelId: string,
  tenantId: string | null,
): Promise<DiscoveredModel & { agents: DiscoveredAgent[] }> {
  const model = await repo.findModelById(modelId, tenantId);
  if (!model) throw new NotFoundError("Model not found");
  const agents = await repo.getAgentsForModel(modelId, tenantId);
  return { ...model, agents };
}

export async function updateModel(
  modelId: string,
  tenantId: string | null,
  patch: UpdateModelInput,
  reviewedBy: string | null,
): Promise<DiscoveredModel> {
  const updated = await repo.updateDiscoveredModel(modelId, tenantId, {
    ...patch,
    reviewed_by: reviewedBy ?? undefined,
  });
  if (!updated) throw new NotFoundError("Model not found");
  return updated;
}

// ─── INTERNAL: Scan orchestration ────────────────────────────────────────────

async function runScan(
  scanId: string,
  connectors: CloudConnectorWithSecrets[],
  tenantId: string | null,
  triggeredBy: string | null = null,
  triggeredByEmail: string | null = null,
  isAuto: boolean = false,
): Promise<void> {
  const scanStartedAt = Date.now();
  await repo.updateScanStatus(scanId, "running");

  const byIntegration: ScanStats["byIntegration"] = {};
  let totalAgents = 0;
  let totalModels = 0;

  const results = await Promise.allSettled(
    connectors.map((c) =>
      runConnectorScan(scanId, c, tenantId).then((r) => {
        byIntegration[c.id] = {
          found: r.agentsFound,
          models: 0,
          errors: r.errorCount,
        };
        totalAgents += r.agentsFound;
        return r;
      }),
    ),
  );

  // Extract models from all agents ingested in this scan
  try {
    totalModels = await extractAndUpsertModels(scanId, tenantId, byIntegration);
  } catch (err: any) {
    await repo.createScanLog(
      scanId,
      "warn",
      `Model extraction failed: ${err.message}`,
    );
  }

  const allFailed = results.every((r) => r.status === "rejected");
  const finalStatus = allFailed ? "failed" : "completed";
  const errorMessage = allFailed
    ? ((results[0] as PromiseRejectedResult).reason?.message ??
      "All connectors failed")
    : null;

  const stats: ScanStats = { totalAgents, totalModels, byIntegration };
  await repo.updateScanStatus(scanId, finalStatus, stats as any, errorMessage);

  const durationMs = Date.now() - scanStartedAt;

  // Audit: scan.completed or scan.failed
  const byIntegrationSummary = Object.fromEntries(
    connectors.map((c) => [
      c.name,
      { agents_found: byIntegration[c.id]?.found ?? 0, errors: byIntegration[c.id]?.errors ?? 0 },
    ]),
  );

  const finalEventType = allFailed 
    ? "scan.failed" 
    : (isAuto ? "scan.auto_completed" : "scan.completed");

  audit.log({
    tenantId,
    userId: triggeredBy,
    userEmail: triggeredByEmail,
    eventType: finalEventType as any,
    entityType: "scan",
    entityId: scanId,
    action: isAuto ? "auto" as any : "trigger",
    status: allFailed ? "failure" : "success",
    summary: allFailed
      ? `Scan failed: ${errorMessage}`
      : `${isAuto ? "Automated Scan" : "Scan"} completed in ${(durationMs / 1000).toFixed(1)}s — ${totalAgents} agent(s) found, ${totalModels} model(s) discovered`,
    after: {
      scan_id: scanId,
      duration_ms: durationMs,
      total_agents: totalAgents,
      total_models: totalModels,
      by_integration: byIntegrationSummary,
      final_status: finalStatus,
    },
    metadata: allFailed ? { error: errorMessage } : null,
  });
}

async function runConnectorScan(
  scanId: string,
  connector: CloudConnectorWithSecrets,
  tenantId: string | null,
): Promise<{ agentsFound: number; errorCount: number }> {
  await repo.updateScanIntegrationStatus(scanId, connector.id, "running");
  await repo.createScanLog(
    scanId,
    "info",
    `Starting scan for ${connector.provider} connector: ${connector.name}`,
    connector.id,
  );

  let agentsFound = 0;
  const errors: unknown[] = [];

  try {
    const decrypted = decryptSecrets(connector.secrets_encrypted);
    const conn = buildScannerConn(connector, decrypted);
    const scanner = await loadScanner(connector.provider as ScanProvider);

    let observations: ScannerRawObservation[] = [];
    let discoveryErrors: unknown[] = [];

    // Dispatch to provider scanner
    if (connector.provider === "aws") {
      const result = await (scanner as any).discoverAwsConnector(conn);
      observations = (result.observations ?? []) as ScannerRawObservation[];
      discoveryErrors = result.discoveryErrors ?? [];
    } else if (connector.provider === "azure") {
      const result = await (scanner as any).discoverAzureScanner?.(conn);
      observations = (result?.observations ?? []) as ScannerRawObservation[];
      discoveryErrors = result?.discoveryErrors ?? [];
    } else if (connector.provider === "gcp") {
      const result = await (scanner as any).discoverGcpConnector?.(conn);
      observations = (result?.observations ?? []) as ScannerRawObservation[];
      discoveryErrors = result?.discoveryErrors ?? [];
    } else if (
      connector.provider === "github" ||
      connector.provider === "gitlab"
    ) {
      const result = await (scanner as any).discoverGitSourceConnector?.({
        ...conn,
        provider: connector.provider,
      });
      observations = (result?.observations ?? []) as ScannerRawObservation[];
    } else if (
      connector.provider === "jenkins" ||
      connector.provider === "github_actions" ||
      connector.provider === "gitlab_ci"
    ) {
      const result = await (scanner as any).discoverCiConnector?.({
        ...conn,
        provider: connector.provider,
      });
      observations = (result?.observations ?? []) as ScannerRawObservation[];
    } else if (
      connector.provider === "crowdstrike" ||
      connector.provider === "defender" ||
      connector.provider === "intune" ||
      connector.provider === "cortex" ||
      connector.provider === "cortex_xdr" ||
      connector.provider === "netskope"
    ) {
      const providerKey =
        connector.provider === "cortex_xdr" ? "cortex" : connector.provider;
      const result = await (scanner as any).discoverEdrConnector?.({
        ...conn,
        provider: providerKey,
      });
      observations = (result?.observations ?? []) as ScannerRawObservation[];
      discoveryErrors = result?.discoveryErrors ?? [];
    } else if (
      connector.provider === "kubernetes" ||
      connector.provider === "k8s"
    ) {
      const result = await (scanner as any).discoverK8sConnector?.(conn);
      observations = (result?.observations ?? []) as ScannerRawObservation[];
    } else if (
      connector.provider === "m365_copilot" ||
      connector.provider === "salesforce" ||
      connector.provider === "workday" ||
      connector.provider === "servicenow" ||
      connector.provider === "openai"
    ) {
      const result = await (scanner as any).discoverSaasConnector?.({
        ...conn,
        provider: connector.provider,
      });
      observations = (result?.observations ?? []) as ScannerRawObservation[];
      discoveryErrors = result?.discoveryErrors ?? [];
    }

    // Upsert each valid observation
    for (const obs of observations) {
      // Skip meta/connector-scan rows produced by the scanner itself
      if ((obs.metadata as any)?.inventoryClass === "connector_scan") continue;
      if (!obs.fingerprint) continue;

      try {
        const isNew = !(await repo.findAgentByFingerprint(obs.fingerprint, tenantId));
        const saved = await repo.upsertDiscoveredAgent(tenantId, scanId, connector.id, obs);
        if (obs.metadata?.agentStatus === 'confirmed' || obs.metadata?.agentStatus === 'candidate') {
          agentsFound++;
        }

        // Security assessment — non-blocking, must not affect discovery pipeline
        if (saved?.id) {
          setImmediate(() => {
            securityAssessAndStore(saved.id, tenantId, scanId).catch((err) => {
              console.warn(`[security] assessAndStore failed for ${saved.id}:`, err?.message);
            });
          });
        }

        // Audit: agent.discovered (new) or agent.updated (rescan)
        if (isNew) {
          audit.log({
            tenantId,
            eventType: "agent.discovered",
            entityType: "agent",
            entityId: saved?.id ?? null,
            entityName: obs.name ?? obs.fingerprint,
            action: "create",
            summary: `New agent discovered: ${obs.name ?? obs.fingerprint} [${obs.provider ?? "unknown"} / ${obs.region ?? ""} / ${obs.framework ?? ""}]`,
            after: {
              fingerprint: obs.fingerprint,
              provider: obs.provider,
              region: obs.region,
              framework: obs.framework,
              running_status: obs.running_status,
              agent_status: (obs.metadata as any)?.agentStatus ?? null,
              governance_status: "shadow",
              confidence_score: obs.confidence_score ?? null,
              risk_indicators: obs.risk_indicators ?? [],
              scan_id: scanId,
              integration_name: connector.name,
            },
          });
        } else {
          audit.log({
            tenantId,
            eventType: "agent.updated",
            entityType: "agent",
            entityId: saved?.id ?? null,
            entityName: obs.name ?? obs.fingerprint,
            action: "update",
            summary: `Agent '${obs.name ?? obs.fingerprint}' re-scanned and data refreshed`,
            metadata: { scan_id: scanId, integration_name: connector.name },
          });
        }
      } catch (err: any) {
        errors.push({
          fingerprint: obs.fingerprint,
          error: err.message?.slice(0, 200),
        });
      }
    }

    if (discoveryErrors.length) {
      errors.push(...discoveryErrors.slice(0, 50));
      await repo.createScanLog(
        scanId,
        "warn",
        `${connector.name}: ${discoveryErrors.length} discovery errors`,
        connector.id,
        { count: discoveryErrors.length, samples: discoveryErrors.slice(0, 5) },
      );
    }
  } catch (err: any) {
    const msg = err.message?.slice(0, 500) ?? "Unknown error";
    errors.push({ error: msg });
    await repo.createScanLog(
      scanId,
      "error",
      `${connector.name} scan failed: ${msg}`,
      connector.id,
    );
    await repo.updateScanIntegrationStatus(
      scanId,
      connector.id,
      "failed",
      0,
      0,
      errors,
    );
    throw err;
  }

  await repo.updateScanIntegrationStatus(
    scanId,
    connector.id,
    "completed",
    agentsFound,
    0,
    errors,
  );
  await repo.createScanLog(
    scanId,
    "info",
    `${connector.name}: scan complete. Agents found: ${agentsFound}`,
    connector.id,
    { agentsFound, errorCount: errors.length },
  );

  return { agentsFound, errorCount: errors.length };
}

// ─── INTERNAL: Model extraction ───────────────────────────────────────────────

async function extractAndUpsertModels(
  scanId: string,
  tenantId: string | null,
  byIntegration: ScanStats["byIntegration"],
): Promise<number> {
  const agents = await repo.getAgentsByScanId(scanId, tenantId);
  if (!agents.length) return 0;

  let totalUpserted = 0;
  const modelCountByConnector: Record<string, Set<string>> = {};

  for (const agent of agents) {
    const modelRefs = extractModelRefs(agent);
    for (const { name, context, provider: explicitProvider } of modelRefs) {
      // Prefer a provider identified directly from evidence (e.g. an
      // AZURE_OPENAI_* env var) over the name-pattern guess — regex-based
      // inference can't tell "gpt-4o via Azure OpenAI" from "gpt-4o via
      // api.openai.com" just from the model name.
      const provider = explicitProvider || inferModelProvider(name);
      const family = inferModelFamily(name);
      const isNewModel = !(await repo.findModelByNameProvider(tenantId, name, provider));
      const model = await repo.upsertDiscoveredModel(tenantId, {
        name,
        provider,
        family: family ?? undefined,
      });
      await repo.upsertAgentModelUsage(agent.id, model.id, context);
      await repo.recalculateModelAgentCount(model.id);
      totalUpserted++;

      // Audit: model.discovered (first time only)
      if (isNewModel) {
        audit.log({
          tenantId,
          eventType: "model.discovered",
          entityType: "model",
          entityId: model.id,
          entityName: name,
          action: "create",
          summary: `New model detected: ${name} (${provider}) — used by 1 agent`,
          after: {
            name,
            provider,
            family: family ?? null,
            validation_status: "pending",
            agent_count: 1,
          },
        });
      }

      if (agent.integration_id) {
        if (!modelCountByConnector[agent.integration_id]) {
          modelCountByConnector[agent.integration_id] = new Set();
        }
        modelCountByConnector[agent.integration_id].add(model.id);
      }
    }
  }

  // Update models_found on scan_integrations
  for (const [integrationId, modelIds] of Object.entries(
    modelCountByConnector,
  )) {
    await repo.updateScanIntegrationStatus(
      scanId,
      integrationId,
      "completed",
      undefined,
      modelIds.size,
    );
    if (byIntegration[integrationId]) {
      byIntegration[integrationId].models = modelIds.size;
    }
  }

  return totalUpserted;
}

/** Extract all model name references from a single discovered agent row. */
export function extractModelRefs(
  agent: DiscoveredAgent,
): Array<{ name: string; context: string; provider?: string }> {
  const refs: Array<{ name: string; context: string; provider?: string }> = [];
  const seen = new Set<string>();

  function add(
    name: string | null | undefined,
    context: string,
    provider?: string,
  ) {
    if (!name || name === "unknown" || seen.has(name)) return;
    seen.add(name);
    refs.push(provider ? { name, context, provider } : { name, context });
  }

  // Primary model field
  add(agent.model, "primary");

  // From agent_config.models[]
  const configModels = (agent.agent_config as any)?.models as unknown[];
  if (Array.isArray(configModels)) {
    for (const m of configModels) {
      if (typeof m === "string") add(m, "primary");
    }
  }

  // From metadata.agentConfig.models[]
  const metaModels = (agent.metadata as any)?.agentConfig?.models as unknown[];
  if (Array.isArray(metaModels)) {
    for (const m of metaModels) {
      if (typeof m === "string") add(m, "primary");
    }
  }

  // From metadata.hostedRuntime.models[] — models declared inside a hosted
  // Foundry agent's Container App (LangGraph/LangChain/etc.), extracted by
  // the Azure scanner's extractHostedModelConfiguration(). Only "declared"
  // entries with a resolved modelName are registered here — "unresolved"
  // entries (bare deployment name/endpoint, no confirmed model) are kept in
  // the agent's own metadata for visibility but never fabricated into a
  // model record.
  const hostedModels = (agent.metadata as any)?.hostedRuntime?.models as
    | unknown[]
    | undefined;
  if (Array.isArray(hostedModels)) {
    for (const m of hostedModels) {
      const entry = m as Record<string, unknown>;
      if (
        entry?.discoveryStatus === "declared" &&
        typeof entry.modelName === "string" &&
        entry.modelName
      ) {
        add(
          entry.modelName,
          "primary",
          typeof entry.provider === "string" ? entry.provider : undefined,
        );
      }
    }
  }

  return refs;
}

function inferModelProvider(name: string): string {
  const n = name.toLowerCase();
  if (/gpt-|o1-|o3-|o4-|text-davinci|text-embedding-|dall-e|whisper/.test(n))
    return "openai";
  if (/claude-|claude\d|anthropic/.test(n)) return "anthropic";
  if (/gemini-|palm-|bison|gecko|text-bison/.test(n)) return "google";
  if (/bedrock-|amazon-|titan-|nova-|jurassic|amazon\./.test(n))
    return "aws";
  if (/azure-/.test(n)) return "azure";
  if (/llama-?[0-9]?|llama\d|meta-llama/.test(n)) return "meta";
  if (/mistral-|mixtral/.test(n)) return "mistral";
  if (/command-|embed-/.test(n)) return "cohere";
  if (/lambda-ai|lambda-workload|sagemaker/.test(n)) return "aws";
  return "unknown";
}

function inferModelFamily(name: string): string | null {
  const n = name.toLowerCase();
  if (n.startsWith("gpt-4") || n.startsWith("gpt4")) return "gpt-4";
  if (n.startsWith("gpt-3") || n.startsWith("gpt3")) return "gpt-3";
  if (n.startsWith("o1-") || n === "o1") return "o1";
  if (n.startsWith("o3-") || n === "o3") return "o3";
  if (n.startsWith("claude-3")) return "claude-3";
  if (n.startsWith("claude-2")) return "claude-2";
  if (n.startsWith("gemini-")) return "gemini";
  if (n.startsWith("llama-2") || n.startsWith("llama2")) return "llama-2";
  if (n.startsWith("llama-3") || n.startsWith("llama3")) return "llama-3";
  if (n.startsWith("mistral-")) return "mistral";
  return null;
}

// ─── INTERNAL: Scanner conn builder ──────────────────────────────────────────

/**
 * Build the `conn` object each scanner expects.
 * AWS scanner reads accessKeyId from config (not secrets) — so we merge it in.
 */
function buildScannerConn(
  connector: CloudConnectorWithSecrets,
  decryptedSecrets: Record<string, unknown>,
): Record<string, unknown> {
  const baseConn = {
    id: connector.id,
    name: connector.name,
    environment: connector.environment,
    provider: connector.provider,
  };

  if (connector.provider === "aws") {
    // AWS scanner reads accessKeyId from config
    const { accessKeyId, ...restSecrets } = decryptedSecrets as any;
    const finalConfig = { ...(connector.config as object) } as any;
    if (accessKeyId !== undefined) {
      finalConfig.accessKeyId = accessKeyId;
    }
    return {
      ...baseConn,
      config: finalConfig,
      secrets: restSecrets,
    };
  }

  return {
    ...baseConn,
    config: connector.config,
    secrets: decryptedSecrets,
  };
}
