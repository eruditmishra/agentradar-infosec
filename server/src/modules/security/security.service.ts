// @ts-nocheck
/**
 * security.service.ts
 *
 * Orchestrates the full OWASP security assessment pipeline:
 *  1. Load agent from DB
 *  2. Normalize evidence (evidence.normalizer.ts)
 *  3. Run OWASP rules (owasp.rules.ts)
 *  4. Compute evidence completeness (evidence.completeness.ts)
 *  5. Build runtime test stubs (runtime.tests.ts)
 *  6. Detect drift against previous assessment
 *  7. Store in agent_security_assessments
 *
 * Called by discovery.service.ts after each agent upsert (non-blocking).
 * Also callable on-demand via the security API endpoint.
 */

import { normalizeSecurityDomains } from "./evidence.normalizer";
import { runAllFrameworks } from "./frameworks/framework.registry";
import { computeEvidenceCompleteness } from "./evidence.completeness";
import { buildPendingTestsForAssessment } from "./runtime.tests";
import {
  upsertSecurityAssessment,
  getSecurityAssessment,
  recordDriftEvents,
} from "./security.repo";
import { db } from "../../db/client";
import type { SecurityAssessment, SecurityDriftEvent, ControlAssessment } from "./evidence.types";

// ─── Assess a raw agent object ────────────────────────────────────────────────

/**
 * Pure function: produce a SecurityAssessment from an agent object.
 * Does NOT read from or write to the database.
 */
export function assessAgent(agent: any): SecurityAssessment {
  const { domains, evidence_sources } = normalizeSecurityDomains(agent);
  const frameworks = runAllFrameworks(domains);
  const completeness = computeEvidenceCompleteness(domains);

  // Build runtime test stubs from every framework's control assessments
  const allControls: Record<string, ControlAssessment> = {};
  for (const fw of Object.values(frameworks)) {
    Object.assign(allControls, fw.controls);
  }
  const runtimeTests = buildPendingTestsForAssessment(allControls);

  return {
    schema_version: "2.0",
    assessment_time: new Date().toISOString(),
    evidence_sources,
    domains,
    frameworks,
    evidence_completeness: completeness,
    runtime_tests: runtimeTests,
  };
}

// ─── Drift detection ──────────────────────────────────────────────────────────

/**
 * Compare two OWASP assessments and detect security-relevant changes.
 * Only changes that affect security posture or evidence completeness are recorded.
 */
function detectDrift(
  previous: SecurityAssessment | null,
  current: SecurityAssessment,
): SecurityDriftEvent[] {
  if (!previous) return [];

  const events: SecurityDriftEvent[] = [];

  // 1. Control status changes across every registered framework
  const frameworkIds = new Set([
    ...Object.keys(current.frameworks ?? {}),
    ...Object.keys(previous.frameworks ?? {}),
  ]);
  for (const fwId of frameworkIds) {
    const curControls = current.frameworks?.[fwId]?.controls ?? {};
    const prevControls = previous.frameworks?.[fwId]?.controls ?? {};
    const controlIds = new Set([...Object.keys(curControls), ...Object.keys(prevControls)]);
    for (const id of controlIds) {
      const cur: ControlAssessment | undefined = curControls[id];
      const prev: ControlAssessment | undefined = prevControls[id];
      if (!cur || !prev) continue;
      if (cur.status !== prev.status) {
        events.push({
          change_type: "control_status_changed",
          summary: `${fwId}/${id} changed from ${prev.status} → ${cur.status}`,
          affected_owasp: [`${fwId}:${id}`],
          previous_value: { status: prev.status, confidence: prev.assessment_confidence },
          current_value: { status: cur.status, confidence: cur.assessment_confidence },
          reassessment_required: cur.status === "detected",
        });
      }
    }
  }

  // 2. Evidence completeness drop > 10%
  const prevOverall = previous.evidence_completeness?.overall ?? 0;
  const curOverall = current.evidence_completeness?.overall ?? 0;
  if (prevOverall - curOverall > 0.1) {
    events.push({
      change_type: "evidence_completeness_drop",
      summary: `Evidence completeness dropped from ${(prevOverall * 100).toFixed(0)}% → ${(curOverall * 100).toFixed(0)}%`,
      affected_owasp: [],
      previous_value: { overall: prevOverall },
      current_value: { overall: curOverall },
      reassessment_required: true,
    });
  }

  // 3. Tool inventory changes
  const prevToolCount = Object.keys(previous.domains?.tools?.items ?? {}).length;
  const prevToolStatus = previous.domains?.tools?.collection_status;
  const curToolStatus = current.domains?.tools?.collection_status;
  const curToolCount = current.domains?.tools?.items?.length ?? 0;

  if (prevToolStatus !== curToolStatus) {
    events.push({
      change_type: "tool_collection_status_changed",
      summary: `Tool collection status changed from ${prevToolStatus} → ${curToolStatus}`,
      affected_owasp: ["owasp_ai_agents_2026:AAI02", "owasp_ai_agents_2026:AAI03"],
      previous_value: { collection_status: prevToolStatus },
      current_value: { collection_status: curToolStatus },
      reassessment_required: true,
    });
  } else if (prevToolCount !== curToolCount && curToolStatus === "observed") {
    events.push({
      change_type: "tool_inventory_changed",
      summary: `Tool count changed from ${prevToolCount} → ${curToolCount}`,
      affected_owasp: ["owasp_ai_agents_2026:AAI02", "owasp_ai_agents_2026:AAI03"],
      previous_value: { tool_count: prevToolCount },
      current_value: { tool_count: curToolCount },
      reassessment_required: true,
    });
  }

  // 4. Model change
  const prevModel = previous.domains?.model?.name?.value;
  const curModel = current.domains?.model?.name?.value;
  if (prevModel && curModel && prevModel !== curModel) {
    events.push({
      change_type: "model_changed",
      summary: `Model changed from ${prevModel} → ${curModel}`,
      affected_owasp: ["owasp_ai_agents_2026:AAI07", "iso_42001:A.4.2"],
      previous_value: { model: prevModel },
      current_value: { model: curModel },
      reassessment_required: true,
    });
  }

  // 5. Guardrail removal
  const prevGuardrails = previous.domains?.guardrails?.present;
  const curGuardrails = current.domains?.guardrails?.present;
  const curGuardrailsStatus = current.domains?.guardrails?.collection_status;
  if (prevGuardrails === true && curGuardrails === false && curGuardrailsStatus === "observed") {
    events.push({
      change_type: "guardrail_removed",
      summary: "Guardrail/content filter was present previously but not found now",
      affected_owasp: ["owasp_ai_agents_2026:AAI02", "owasp_ai_agents_2026:AAI08", "owasp_ai_agents_2026:AAI10", "nist_ai_rmf:MEASURE-2"],
      previous_value: { guardrails_present: true },
      current_value: { guardrails_present: false },
      reassessment_required: true,
    });
  }

  // 6. Owner removed
  const prevOwner = previous.domains?.identity?.owner?.value;
  const curOwner = current.domains?.identity?.owner?.value;
  const curOwnerStatus = current.domains?.identity?.owner?.status;
  if (prevOwner && !curOwner && curOwnerStatus === "not_observed") {
    events.push({
      change_type: "owner_removed",
      summary: "Agent owner was present previously but is now empty",
      affected_owasp: ["owasp_ai_agents_2026:AAI01", "nist_ai_rmf:GOVERN-2", "iso_42001:A.3.2"],
      previous_value: { owner: prevOwner },
      current_value: { owner: null },
      reassessment_required: false,
    });
  }

  return events;
}

// ─── Assess and store ─────────────────────────────────────────────────────────

/**
 * Load an agent from the DB, run the full assessment pipeline,
 * detect drift vs. previous, store results, record drift events.
 *
 * This is the main entry point called from the discovery service.
 * It is always called non-blocking (setImmediate) — errors are logged, not thrown.
 */
export async function assessAndStore(
  agentId: string,
  tenantId: string | null,
  scanId: string | null = null,
): Promise<void> {
  // Load agent
  const agentResult = await db.query(
    `SELECT * FROM discovered_agents
     WHERE id = $1
       AND ($2::uuid IS NULL OR tenant_id = $2)
     LIMIT 1`,
    [agentId, tenantId],
  );

  if (!agentResult.rows.length) {
    console.warn(`[security] assessAndStore: agent ${agentId} not found`);
    return;
  }

  const agent = agentResult.rows[0];

  // Load previous assessment for drift detection
  let previous: SecurityAssessment | null = null;
  try {
    previous = await getSecurityAssessment(agentId, tenantId);
  } catch {
    // Not fatal — drift detection skipped
  }

  // Run assessment pipeline
  const assessment = assessAgent(agent);

  // Detect drift
  const driftEvents = detectDrift(previous, assessment);
  assessment.drift = driftEvents;

  // Store assessment
  await upsertSecurityAssessment(agentId, tenantId, assessment);

  // Record drift events
  if (driftEvents.length > 0) {
    await recordDriftEvents(agentId, tenantId, scanId, driftEvents).catch((err) => {
      console.warn(`[security] Failed to record drift events for ${agentId}:`, err?.message);
    });
  }
}

// ─── Get or compute ────────────────────────────────────────────────────────────

/**
 * Return a stored assessment, or compute one on-the-fly if not stored.
 * The on-the-fly result is NOT stored (read-only path for API).
 */
export async function getOrComputeAssessment(
  agentId: string,
  tenantId: string | null,
): Promise<SecurityAssessment | null> {
  // Try stored first — but a row persisted before the multi-framework schema
  // (schema_version < 2.0, or an empty `frameworks` map) is stale and must
  // be recomputed rather than trusted, or every control table would render empty.
  const stored = await getSecurityAssessment(agentId, tenantId);
  const storedIsFresh = stored && stored.schema_version === "2.0" && Object.keys(stored.frameworks ?? {}).length > 0;
  if (storedIsFresh) return stored;

  // Compute fresh (and persist it so subsequent reads, and the tenant-wide
  // assessments list, don't keep recomputing on every request)
  const agentResult = await db.query(
    `SELECT * FROM discovered_agents
     WHERE id = $1
       AND ($2::uuid IS NULL OR tenant_id = $2)
     LIMIT 1`,
    [agentId, tenantId],
  );
  if (!agentResult.rows.length) return null;

  const assessment = assessAgent(agentResult.rows[0]);
  await upsertSecurityAssessment(agentId, tenantId, assessment).catch((err) => {
    console.warn(`[security] Failed to persist recomputed assessment for ${agentId}:`, err?.message);
  });
  return assessment;
}

// ─── Bulk reassessment ─────────────────────────────────────────────────────────

/**
 * Reassess all agents for a tenant (background job, e.g. triggered by rule update).
 * Processes in batches to avoid overwhelming the DB.
 */
export async function bulkReassessTenant(
  tenantId: string | null,
  batchSize = 20,
): Promise<{ processed: number; errors: number }> {
  const result = await db.query(
    `SELECT id FROM discovered_agents
     WHERE ($1::uuid IS NULL OR tenant_id = $1)
     ORDER BY updated_at DESC`,
    [tenantId],
  );

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < result.rows.length; i += batchSize) {
    const batch = result.rows.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (row: any) => {
        try {
          await assessAndStore(row.id, tenantId, null);
          processed++;
        } catch (err: any) {
          console.error(`[security] bulk reassess failed for agent ${row.id}:`, err?.message);
          errors++;
        }
      }),
    );
  }

  return { processed, errors };
}
