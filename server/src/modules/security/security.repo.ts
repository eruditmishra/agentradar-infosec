// @ts-nocheck
/**
 * security.repo.ts
 *
 * Database repository for security assessments and drift events.
 * Tables: agent_security_assessments, agent_security_drift
 */

import { db as pool } from "../../db/client";
import type { SecurityAssessment, SecurityDriftEvent } from "./evidence.types";

// ─── Upsert assessment ─────────────────────────────────────────────────────────

/**
 * Upsert (insert or update) a security assessment for an agent.
 * Returns the stored row's id.
 */
export async function upsertSecurityAssessment(
  agentId: string,
  tenantId: string | null,
  assessment: SecurityAssessment,
): Promise<string> {
  // The table has two separate partial unique indexes — one for
  // (agent_id, tenant_id) WHERE tenant_id IS NOT NULL, and one for
  // (agent_id) WHERE tenant_id IS NULL. ON CONFLICT must target whichever
  // index actually matches this row's tenant_id, or Postgres throws a raw
  // duplicate-key error instead of upserting (no-tenant deployments would
  // otherwise never successfully update an existing assessment).
  const conflictClause = tenantId !== null
    ? `ON CONFLICT (agent_id, tenant_id) WHERE tenant_id IS NOT NULL`
    : `ON CONFLICT (agent_id) WHERE tenant_id IS NULL`;

  const result = await pool.query(
    `INSERT INTO agent_security_assessments
       (agent_id, tenant_id, schema_version, assessment_time,
        evidence_sources, domains, frameworks,
        evidence_completeness, runtime_tests, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ${conflictClause}
       DO UPDATE SET
         schema_version      = EXCLUDED.schema_version,
         assessment_time     = EXCLUDED.assessment_time,
         evidence_sources    = EXCLUDED.evidence_sources,
         domains             = EXCLUDED.domains,
         frameworks          = EXCLUDED.frameworks,
         evidence_completeness = EXCLUDED.evidence_completeness,
         runtime_tests       = EXCLUDED.runtime_tests,
         updated_at          = now()
     RETURNING id`,
    [
      agentId,
      tenantId,
      assessment.schema_version,
      assessment.assessment_time,
      JSON.stringify(assessment.evidence_sources),
      JSON.stringify(assessment.domains),
      JSON.stringify(assessment.frameworks),
      JSON.stringify(assessment.evidence_completeness),
      JSON.stringify(assessment.runtime_tests ?? []),
    ],
  );

  return result.rows[0]?.id ?? "";
}

// ─── Get assessment ────────────────────────────────────────────────────────────

export async function getSecurityAssessment(
  agentId: string,
  tenantId: string | null,
): Promise<SecurityAssessment | null> {
  const result = await pool.query(
    `SELECT schema_version, assessment_time, evidence_sources,
            domains, frameworks, evidence_completeness, runtime_tests
     FROM agent_security_assessments
     WHERE agent_id = $1
       AND ($2::uuid IS NULL OR tenant_id = $2)
     LIMIT 1`,
    [agentId, tenantId],
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  return {
    schema_version: row.schema_version ?? "2.0",
    assessment_time: row.assessment_time,
    evidence_sources: row.evidence_sources ?? [],
    domains: row.domains ?? {},
    frameworks: row.frameworks ?? {},
    evidence_completeness: row.evidence_completeness ?? {},
    runtime_tests: row.runtime_tests ?? [],
  } as SecurityAssessment;
}

// ─── Drift events ──────────────────────────────────────────────────────────────

export async function recordDriftEvents(
  agentId: string,
  tenantId: string | null,
  scanId: string | null,
  events: SecurityDriftEvent[],
): Promise<void> {
  if (!events.length) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of events) {
      await client.query(
        `INSERT INTO agent_security_drift
           (agent_id, tenant_id, scan_id, change_type, summary,
            affected_owasp, previous_value, current_value, reassessment_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          tenantId,
          scanId,
          e.change_type,
          e.summary,
          e.affected_owasp,
          JSON.stringify(e.previous_value ?? null),
          JSON.stringify(e.current_value ?? null),
          e.reassessment_required,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getDriftHistory(
  agentId: string,
  tenantId: string | null,
  limit = 50,
): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, detected_at, change_type, summary, affected_owasp,
            previous_value, current_value, reassessment_required
     FROM agent_security_drift
     WHERE agent_id = $1
       AND ($2::uuid IS NULL OR tenant_id = $2)
     ORDER BY detected_at DESC
     LIMIT $3`,
    [agentId, tenantId, limit],
  );
  return result.rows;
}

// ─── Agent control reviews (tenant-wide, for the Assessments page) ───────────

export interface AgentControlReviewRow {
  agentId: string;
  name: string;
  type: string | null;
  posture: "compliant" | "partial" | "non_compliant" | "unassessed";
  score: number;
  pass: number;
  partial: number;
  fail: number;
  evidenceTags: string[];
}

function posturePriorityStatus(statuses: string[]): "compliant" | "partial" | "non_compliant" | "unassessed" {
  if (!statuses.length) return "unassessed";
  const fail = statuses.filter((s) => s === "detected").length;
  const partial = statuses.filter((s) => s === "control_gap" || s === "unknown").length;
  if (fail > 0) return "non_compliant";
  if (partial > 0) return "partial";
  return "compliant";
}

/**
 * List every agent's control-review summary for a given framework
 * (posture/score/pass/partial/fail), for the tenant-wide Assessments page.
 */
export async function listAgentControlReviews(
  tenantId: string | null,
  frameworkId: string,
): Promise<AgentControlReviewRow[]> {
  const result = await pool.query(
    `SELECT da.id AS agent_id, da.name, da.cloud_provider, da.framework, asa.frameworks
     FROM discovered_agents da
     LEFT JOIN agent_security_assessments asa
       ON da.id = asa.agent_id
       AND ($1::uuid IS NULL OR da.tenant_id = asa.tenant_id)
     WHERE ($1::uuid IS NULL OR da.tenant_id = $1)
     ORDER BY da.name ASC`,
    [tenantId],
  );

  return result.rows.map((row: any): AgentControlReviewRow => {
    const controls: Record<string, any> = row.frameworks?.[frameworkId]?.controls ?? {};
    const values = Object.values(controls) as any[];
    const applicable = values.filter((c) => c.status !== "not_applicable");
    const pass = applicable.filter((c) => c.status === "not_observed").length;
    const partial = applicable.filter((c) => c.status === "unknown" || c.status === "control_gap").length;
    const fail = applicable.filter((c) => c.status === "detected").length;
    const total = applicable.length || 1;
    const score = Math.round((pass / total) * 100);
    const evidenceTags = Array.from(
      new Set(applicable.flatMap((c) => c.source_collectors ?? []).filter((s: string) => s && s !== "unknown")),
    ) as string[];

    return {
      agentId: row.agent_id,
      name: row.name ?? "Unnamed agent",
      type: row.cloud_provider ?? row.framework ?? null,
      posture: posturePriorityStatus(applicable.map((c) => c.status)),
      score: values.length ? score : 0,
      pass,
      partial,
      fail,
      evidenceTags,
    };
  });
}
