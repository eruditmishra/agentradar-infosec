// @ts-nocheck
/**
 * evidence.completeness.ts
 *
 * Computes per-domain evidence completeness scores (0.0–1.0)
 * and an overall weighted average.
 *
 * Design notes:
 *  - Completeness measures EVIDENCE AVAILABILITY, not security posture
 *  - A domain is "complete" when its required fields have status ≠ unknown
 *    and ≠ not_collected
 *  - collection_status = "not_available" DOES count toward completeness
 *    (we know it's unavailable; that IS information)
 *  - collection_status = "unknown" counts as 0 (we don't know why it's missing)
 */

import type {
  SecurityDomains,
  EvidenceCompleteness,
  EvidenceStatus,
  ToolEvidence,
} from "./evidence.types";

// ─── Field completeness helpers ───────────────────────────────────────────────

function statusScore(status: EvidenceStatus | string | undefined): number {
  if (status === "observed" || status === "not_observed" || status === "not_applicable") return 1;
  if (status === "permission_denied") return 0.5; // We know why it's missing, which is a signal (missing permissions)
  if (status === "error" || status === "unsupported") return 0.3; // Attempted but failed/unsupported
  if (status === "not_collected") return 0.1; // Known gap - explicit that it hasn't been collected
  return 0; // unknown, undefined
}

function toolStatusScore(status: EvidenceStatus): number {
  if (status === "observed" || status === "not_observed" || status === "not_applicable") return 1;
  if (status === "permission_denied") return 0.5;
  if (status === "error" || status === "unsupported") return 0.3;
  if (status === "not_collected") return 0.1;
  return 0; // unknown
}

function boolNullScore(v: boolean | null | undefined): number {
  return v !== null && v !== undefined ? 1 : 0;
}

function strNullScore(v: string | null | undefined): number {
  return v !== null && v !== undefined && v !== "" ? 1 : 0;
}

// ─── Per-domain completeness ──────────────────────────────────────────────────

function identityCompleteness(d: SecurityDomains): number {
  const id = d.identity;
  const fields = [
    statusScore(id.object_id.status),
    statusScore(id.app_id.status),
    statusScore(id.tenant_id.status),
    statusScore(id.owner.status),
    statusScore(id.lifecycle_status.status),
    statusScore(id.service_principal_type.status),
    statusScore(id.account_enabled.status),
    statusScore(id.created_at.status),
  ];
  return avg(fields);
}

function modelCompleteness(d: SecurityDomains): number {
  const m = d.model;
  if (m.is_identity_placeholder) {
    // We know it's a placeholder — that IS information
    return 0.25; // partial: we know what it is but not the real model
  }
  const fields = [
    statusScore(m.name.status),
    statusScore(m.provider.status),
    statusScore(m.foundation_model.status),
    statusScore(m.endpoint.status),
    m.verified ? 1 : 0,
  ];
  return avg(fields);
}

function instructionsCompleteness(d: SecurityDomains): number {
  const ins = d.instructions;
  if (ins.collection_status === "unknown") return 0;
  if (ins.collection_status === "not_collected") return 0;

  const fields: number[] = [
    ins.collection_status === "observed" || ins.collection_status === "not_observed" ? 1 : 0,
    ins.present !== null ? 1 : 0,
  ];

  if (ins.present === true) {
    fields.push(
      ins.hash !== null ? 1 : 0,
      ins.length !== null ? 1 : 0,
      ins.contains_safety_rules !== null ? 1 : 0,
      ins.contains_tool_guidance !== null ? 1 : 0,
    );
  }

  return avg(fields);
}

function toolsCompleteness(d: SecurityDomains): number {
  const t = d.tools;
  // collection_status is the critical field
  const colScore = toolStatusScore(t.collection_status);
  if (colScore === 0) return 0.05; // unknown = very low completeness

  // If permission_denied, error, or not_collected, use the base colScore
  if (t.collection_status === "permission_denied" || t.collection_status === "error" || t.collection_status === "not_collected") {
    return colScore;
  }

  if (t.collection_status === "observed") {
    const fields: number[] = [1]; // collection itself is 1
    if (t.items.length > 0) {
      // Check quality of tool entries
      const toolQuality = t.items.map((tool) => {
        const q = [
          tool.name !== null ? 1 : 0,
          tool.description !== null ? 1 : 0,
          tool.risk_flags ? 1 : 0,
        ];
        return avg(q);
      });
      fields.push(avg(toolQuality));
    }
    return avg(fields);
  }

  return 0.3; // partial
}

function permissionsCompleteness(d: SecurityDomains): number {
  const p = d.permissions;
  if (p.collection_status === "not_collected") return 0.05;

  const fields = [
    statusScore(p.application_permissions.status),
    statusScore(p.rbac_roles.status),
    statusScore(p.delegated_permissions.status),
    p.declared_permissions.length > 0 ? 0.5 : 0, // partial credit for declared perms
    p.over_permissioned !== null ? 1 : 0,
    p.write_capable !== null ? 0.5 : 0,
    p.admin_capable !== null ? 0.5 : 0,
  ];
  return avg(fields);
}

function dataAccessCompleteness(d: SecurityDomains): number {
  const da = d.data_access;
  const fields = [
    statusScore(da.database_access.status),
    statusScore(da.email_access.status),
    statusScore(da.calendar_access.status),
    statusScore(da.github_access.status),
    statusScore(da.slack_access.status),
    statusScore(da.filesystem_access.status),
    boolNullScore(da.has_pii),
    boolNullScore(da.has_phi),
  ];
  return avg(fields);
}

function networkCompleteness(d: SecurityDomains): number {
  const n = d.network;
  const fields = [
    statusScore(n.internet_access.status),
    statusScore(n.browser_access.status),
    statusScore(n.public_endpoint.status),
    n.unrestricted_egress !== null ? 1 : 0.2,
  ];
  return avg(fields);
}

function memoryCompleteness(d: SecurityDomains): number {
  const m = d.memory;
  if (m.collection_status === "unknown") return 0.05;
  if (m.collection_status === "not_collected") return 0;

  const fields = [
    m.has_memory !== null ? 1 : 0,
    m.memory_type !== null ? 1 : 0,
    statusScore(m.write_capability.status),
    m.rag_configured !== null ? 1 : 0,
    m.knowledge_bases.length > 0 || m.has_memory === false ? 1 : 0.3,
  ];
  return avg(fields);
}

function guardrailsCompleteness(d: SecurityDomains): number {
  const g = d.guardrails;
  if (g.collection_status === "unknown") return 0.05;
  if (g.collection_status === "not_collected") return 0;

  const fields = [
    g.present !== null ? 1 : 0,
    g.prompt_injection_detection !== null ? 1 : 0,
    g.output_filtering !== null ? 1 : 0,
    g.pii_detection !== null ? 0.5 : 0,
    g.content_filtering !== null ? 0.5 : 0,
    g.data_loss_prevention !== null ? 1 : 0,
  ];
  return avg(fields);
}

function humanOversightCompleteness(d: SecurityDomains): number {
  const h = d.human_oversight;
  if (h.collection_status === "unknown") return 0;

  const fields = [
    statusScore(h.autonomy_level.status),
    statusScore(h.human_approval_required.status),
    h.can_execute_without_user !== null ? 1 : 0,
    h.can_modify_data !== null ? 1 : 0,
    h.max_action_chain.status !== "unknown" ? 1 : 0,
  ];
  return avg(fields);
}

function interAgentCompleteness(d: SecurityDomains): number {
  const ia = d.inter_agent;
  if (ia.collection_status === "not_collected") return 0.1; // attempted, found nothing

  const fields = [
    ia.mcp_servers.length > 0 ? 0.5 : 0.5, // observing 0 is still information
    statusScore(ia.authentication.status),
    statusScore(ia.authorization.status),
  ];
  return avg(fields);
}

function supplyChainCompleteness(d: SecurityDomains): number {
  const sc = d.supply_chain;
  const fields = [
    statusScore(sc.publisher.status),
    statusScore(sc.framework.status),
    statusScore(sc.model_provider.status),
    statusScore(sc.source_repository.status),
    statusScore(sc.artifact_provenance.status),
  ];
  return avg(fields);
}

function runtimeCompleteness(d: SecurityDomains): number {
  if (d.runtime.collection_status === "not_collected") return 0;
  return d.runtime.tests_completed / Math.max(d.runtime.tests_run, 1);
}

// ─── Weighted average ─────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Math.round((total / values.length) * 100) / 100;
}

/** Domain weights for overall completeness score */
const DOMAIN_WEIGHTS: Record<keyof EvidenceCompleteness, number> = {
  overall: 0,        // computed, not weighted itself
  identity: 0.15,
  model: 0.08,
  instructions: 0.12,
  tools: 0.12,
  permissions: 0.12,
  data_access: 0.08,
  network: 0.07,
  memory: 0.07,
  guardrails: 0.08,
  human_oversight: 0.05,
  inter_agent: 0.03,
  supply_chain: 0.03,
  runtime: 0.00,     // runtime is bonus; never penalizes overall
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute per-domain + overall evidence completeness from normalized domains.
 */
export function computeEvidenceCompleteness(d: SecurityDomains): EvidenceCompleteness {
  const scores: Record<string, number> = {
    identity: identityCompleteness(d),
    model: modelCompleteness(d),
    instructions: instructionsCompleteness(d),
    tools: toolsCompleteness(d),
    permissions: permissionsCompleteness(d),
    data_access: dataAccessCompleteness(d),
    network: networkCompleteness(d),
    memory: memoryCompleteness(d),
    guardrails: guardrailsCompleteness(d),
    human_oversight: humanOversightCompleteness(d),
    inter_agent: interAgentCompleteness(d),
    supply_chain: supplyChainCompleteness(d),
    runtime: runtimeCompleteness(d),
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, score] of Object.entries(scores)) {
    const weight = DOMAIN_WEIGHTS[key as keyof EvidenceCompleteness] ?? 0;
    if (weight > 0) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  const overall = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0;

  return {
    overall,
    identity: scores.identity,
    model: scores.model,
    instructions: scores.instructions,
    tools: scores.tools,
    permissions: scores.permissions,
    data_access: scores.data_access,
    network: scores.network,
    memory: scores.memory,
    guardrails: scores.guardrails,
    human_oversight: scores.human_oversight,
    inter_agent: scores.inter_agent,
    supply_chain: scores.supply_chain,
    runtime: scores.runtime,
  };
}
