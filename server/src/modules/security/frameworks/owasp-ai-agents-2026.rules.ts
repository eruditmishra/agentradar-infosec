// @ts-nocheck
/**
 * owasp-ai-agents-2026.rules.ts
 *
 * OWASP AI Agents Top 10 (2026) rule engine — built fresh for the agentic
 * threat model (NOT a reuse of the retired OWASP LLM Top 10 or the earlier
 * ASI01-10 draft rules). Ten categories, each assessed purely from
 * normalized SecurityDomains evidence.
 */

import type { ControlAssessment, SecurityDomains } from "../evidence.types";
import {
  makeControlAssessment,
  toolsFullyCollected,
  toolsUnavailable,
  instructionsUnavailable,
  guardrailsUnknown,
  primaryCollector,
} from "./control.helpers";

const FID = "owasp_ai_agents_2026";
const CAT = "Agentic AI Threats";

/** AAI01 — Agent Authorization & Control Hijacking */
function assessAAI01(d: SecurityDomains): ControlAssessment {
  const identityConfirmed = d.identity.collection_status === "observed";
  const permsNotCollected = d.permissions.collection_status === "not_collected";
  const overPermissioned = d.permissions.over_permissioned;

  if (overPermissioned === true) {
    return makeControlAssessment(FID, "AAI01", "Agent Authorization & Control Hijacking", CAT, "detected", {
      evidence_confidence: 0.75,
      assessment_confidence: 0.6,
      confidence_reason: [
        "Agent identity confirmed and over-permissioned condition detected",
        "An attacker who compromises this agent's context inherits excessive control",
      ],
      evidence: [...d.identity.object_id.evidence, ...d.permissions.evidence],
      related_assets: [d.identity.object_id.value ?? "unknown"],
      requires_runtime_test: true,
      recommended_next_scan: ["runtime_authorization_bypass_test"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (identityConfirmed && permsNotCollected) {
    return makeControlAssessment(FID, "AAI01", "Agent Authorization & Control Hijacking", CAT, "unknown", {
      evidence_confidence: 0.55,
      assessment_confidence: 0.2,
      confidence_reason: [
        "Agent identity confirmed",
        "Effective permission/role assignments not collected — cannot rule out hijack blast radius",
      ],
      evidence: [...d.identity.object_id.evidence],
      missing_evidence: ["Effective RBAC role assignments", "Entra/IAM permission grants"],
      limitations: d.permissions.limitations,
      recommended_next_scan: ["azure_iam_deep_scan", "aws_iam_deep_scan"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.permissions.collection_status === "observed" && overPermissioned === false) {
    return makeControlAssessment(FID, "AAI01", "Agent Authorization & Control Hijacking", CAT, "not_observed", {
      evidence_confidence: 0.7,
      assessment_confidence: 0.5,
      confidence_reason: ["Permission analysis ran; no over-permissioning detected"],
      evidence: d.permissions.evidence,
      limitations: ["Declared permissions only — effective/inherited privilege not verified"],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI01", "Agent Authorization & Control Hijacking", CAT, "unknown", {
    evidence_confidence: 0.3,
    assessment_confidence: 0.2,
    confidence_reason: ["Insufficient identity/permission evidence collected"],
    missing_evidence: ["Agent identity", "Permission grants"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI02 — Goal & Instruction Manipulation */
function assessAAI02(d: SecurityDomains): ControlAssessment {
  if (instructionsUnavailable(d)) {
    return makeControlAssessment(FID, "AAI02", "Goal & Instruction Manipulation", CAT, "unknown", {
      evidence_confidence: 0.15,
      assessment_confidence: 0.1,
      confidence_reason: ["System instructions not available from current collector"],
      missing_evidence: ["System instructions / goal boundaries", "Input sanitization policy"],
      limitations: d.instructions.limitations,
      requires_runtime_test: true,
      recommended_next_scan: ["copilot_studio_definition_plane", "agent_365_catalog"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.instructions.present === true) {
    const safetyRules = d.instructions.contains_safety_rules;
    if (safetyRules === false) {
      return makeControlAssessment(FID, "AAI02", "Goal & Instruction Manipulation", CAT, "control_gap", {
        evidence_confidence: 0.8,
        assessment_confidence: 0.6,
        confidence_reason: ["Instructions present but no explicit goal/scope safety rules detected"],
        evidence: d.instructions.evidence,
        missing_evidence: ["Runtime goal-manipulation test result"],
        requires_runtime_test: true,
        recommended_next_scan: ["runtime_goal_manipulation_test"],
        source_collectors: [primaryCollector(d)],
      });
    }
    if (safetyRules === true) {
      return makeControlAssessment(FID, "AAI02", "Goal & Instruction Manipulation", CAT, "not_observed", {
        evidence_confidence: 0.7,
        assessment_confidence: 0.45,
        confidence_reason: ["Instructions contain explicit goal/scope safety rules"],
        evidence: d.instructions.evidence,
        limitations: ["Static analysis only — runtime bypass not tested"],
        requires_runtime_test: true,
        source_collectors: [primaryCollector(d)],
      });
    }
  }

  return makeControlAssessment(FID, "AAI02", "Goal & Instruction Manipulation", CAT, "unknown", {
    evidence_confidence: 0.3,
    assessment_confidence: 0.15,
    confidence_reason: ["Partial instruction evidence; cannot assess goal manipulation controls"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI03 — Excessive Agency / Tool Over-Permissioning */
function assessAAI03(d: SecurityDomains): ControlAssessment {
  if (toolsUnavailable(d)) {
    return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "unknown", {
      evidence_confidence: 0.15,
      assessment_confidence: 0.1,
      confidence_reason: ["Tool inventory not available from current collector"],
      missing_evidence: ["Tool inventory", "Human approval requirements"],
      limitations: d.tools.limitations,
      recommended_next_scan: ["copilot_studio_definition_plane", "agent_365_catalog"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (toolsFullyCollected(d) && d.tools.items.length === 0) {
    return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "not_applicable", {
      evidence_confidence: 0.9,
      assessment_confidence: 0.9,
      confidence_reason: ["No tools discovered — excessive agency not applicable"],
      source_collectors: [primaryCollector(d)],
    });
  }

  const stateTools = d.tools.items.filter((t) => t.risk_flags.can_modify_state);
  const approvalAbsent = stateTools.filter((t) => t.requires_human_approval === false);
  const oversightUnknown = d.human_oversight.collection_status === "unknown";

  if (approvalAbsent.length > 0) {
    return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "detected", {
      evidence_confidence: 0.85,
      assessment_confidence: 0.7,
      confidence_reason: [`${approvalAbsent.length} state-modifying tool(s) confirmed to require no human approval`],
      evidence: approvalAbsent.flatMap((t) => t.evidence).slice(0, 3),
      related_tools: approvalAbsent.map((t) => t.name ?? "unknown"),
      requires_runtime_test: true,
      recommended_next_scan: ["runtime_excessive_agency_test"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (stateTools.length > 0 && oversightUnknown) {
    return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "unknown", {
      evidence_confidence: 0.5,
      assessment_confidence: 0.3,
      confidence_reason: [`${stateTools.length} state-modifying tool(s) found`, "Human oversight policy not collected"],
      evidence: stateTools.flatMap((t) => t.evidence).slice(0, 3),
      related_tools: stateTools.map((t) => t.name ?? "unknown"),
      missing_evidence: ["Autonomy level", "Human approval requirements"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (stateTools.length === 0) {
    return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "not_observed", {
      evidence_confidence: 0.6,
      assessment_confidence: 0.4,
      confidence_reason: ["No state-modifying tools found in tool inventory"],
      evidence: [{ fact: `${d.tools.items.length} tool(s) scanned — none modify state`, source: primaryCollector(d), collection_method: "api" }],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI03", "Excessive Agency / Tool Over-Permissioning", CAT, "control_gap", {
    evidence_confidence: 0.6,
    assessment_confidence: 0.4,
    confidence_reason: [`${stateTools.length} state-modifying tool(s) present without a confirmed approval gate`],
    evidence: stateTools.flatMap((t) => t.evidence).slice(0, 3),
    related_tools: stateTools.map((t) => t.name ?? "unknown"),
    requires_runtime_test: true,
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI04 — Memory & Context Poisoning */
function assessAAI04(d: SecurityDomains): ControlAssessment {
  if (d.memory.collection_status === "unknown" || d.memory.collection_status === "not_collected") {
    return makeControlAssessment(FID, "AAI04", "Memory & Context Poisoning", CAT, "unknown", {
      evidence_confidence: 0.15,
      assessment_confidence: 0.1,
      confidence_reason: ["Memory/RAG configuration not available from current collector"],
      missing_evidence: ["Memory write access controls", "Ingestion pipeline security"],
      limitations: d.memory.limitations,
      recommended_next_scan: ["copilot_studio_definition_plane", "bedrock_definition_scan"],
      source_collectors: [primaryCollector(d)],
    });
  }

  const hasMemoryStores = d.memory.knowledge_bases.length > 0 || d.memory.vector_stores.length > 0;

  if (!hasMemoryStores && d.memory.has_memory === false) {
    return makeControlAssessment(FID, "AAI04", "Memory & Context Poisoning", CAT, "not_applicable", {
      evidence_confidence: 0.7,
      assessment_confidence: 0.6,
      confidence_reason: ["No persistent memory, knowledge bases, or vector stores found"],
      evidence: d.memory.evidence,
      source_collectors: [primaryCollector(d)],
    });
  }

  if (hasMemoryStores && d.memory.write_capability.value === null) {
    return makeControlAssessment(FID, "AAI04", "Memory & Context Poisoning", CAT, "unknown", {
      evidence_confidence: 0.5,
      assessment_confidence: 0.3,
      confidence_reason: [
        `${d.memory.knowledge_bases.length} knowledge base(s) / ${d.memory.vector_stores.length} vector store(s) found`,
        "Write access controls not assessed",
      ],
      evidence: d.memory.evidence,
      missing_evidence: ["Ingestion pipeline write access controls", "Memory integrity policy"],
      requires_runtime_test: true,
      recommended_next_scan: ["runtime_memory_poisoning_test"],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI04", "Memory & Context Poisoning", CAT, "unknown", {
    evidence_confidence: 0.4,
    assessment_confidence: 0.2,
    confidence_reason: ["Memory status partially assessed"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI05 — Insecure Inter-Agent & Tool Communication */
function assessAAI05(d: SecurityDomains): ControlAssessment {
  if (d.inter_agent.collection_status === "not_collected") {
    return makeControlAssessment(FID, "AAI05", "Insecure Inter-Agent & Tool Communication", CAT, "unknown", {
      evidence_confidence: 0.2,
      assessment_confidence: 0.15,
      confidence_reason: ["Inter-agent/MCP communication not collected from current discovery plane"],
      missing_evidence: ["MCP server inventory", "Authentication policies"],
      recommended_next_scan: ["mcp_connection_scan"],
      source_collectors: [primaryCollector(d)],
    });
  }

  const mcpServers = d.inter_agent.mcp_servers;
  const confirmedUnauthed = mcpServers.filter((m) => m.auth_present === false);
  const unknownAuth = mcpServers.filter((m) => m.auth_present !== false && m.auth_type === null);

  if (mcpServers.length > 0 && confirmedUnauthed.length > 0) {
    return makeControlAssessment(FID, "AAI05", "Insecure Inter-Agent & Tool Communication", CAT, "detected", {
      evidence_confidence: 0.85,
      assessment_confidence: 0.75,
      confidence_reason: [`${confirmedUnauthed.length}/${mcpServers.length} MCP server(s) confirmed to lack authentication`],
      evidence: confirmedUnauthed.flatMap((m) => m.evidence).slice(0, 3),
      related_assets: confirmedUnauthed.map((m) => m.name ?? m.endpoint ?? "unknown"),
      requires_runtime_test: true,
      recommended_next_scan: ["mcp_auth_validation"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (mcpServers.length > 0 && unknownAuth.length > 0) {
    return makeControlAssessment(FID, "AAI05", "Insecure Inter-Agent & Tool Communication", CAT, "unknown", {
      evidence_confidence: 0.5,
      assessment_confidence: 0.3,
      confidence_reason: [`${unknownAuth.length}/${mcpServers.length} MCP server(s) found, auth type not collected`],
      evidence: unknownAuth.flatMap((m) => m.evidence).slice(0, 3),
      missing_evidence: ["Authentication mechanism type", "Channel encryption"],
      recommended_next_scan: ["mcp_auth_validation"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (mcpServers.length === 0) {
    return makeControlAssessment(FID, "AAI05", "Insecure Inter-Agent & Tool Communication", CAT, "not_observed", {
      evidence_confidence: 0.6,
      assessment_confidence: 0.4,
      confidence_reason: ["No inter-agent connections discovered"],
      evidence: d.inter_agent.evidence,
      limitations: ["Absence of observed connections does not rule out hidden channels"],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI05", "Insecure Inter-Agent & Tool Communication", CAT, "not_observed", {
    evidence_confidence: 0.5,
    assessment_confidence: 0.4,
    confidence_reason: [`${mcpServers.length} MCP server(s) found; authentication confirmed present`],
    evidence: mcpServers.flatMap((m) => m.evidence).slice(0, 3),
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI06 — Cascading Failures / Blast Radius */
function assessAAI06(d: SecurityDomains): ControlAssessment {
  const hasConnections = d.inter_agent.mcp_servers.length > 0 || d.inter_agent.connected_agents.length > 0;
  const overPermissioned = d.permissions.over_permissioned === true;

  if (hasConnections && overPermissioned) {
    return makeControlAssessment(FID, "AAI06", "Cascading Failures / Blast Radius", CAT, "control_gap", {
      evidence_confidence: 0.7,
      assessment_confidence: 0.5,
      confidence_reason: ["Agent is over-permissioned AND connected to other agents/tools — failure blast radius is elevated"],
      evidence: [...d.permissions.evidence, ...d.inter_agent.evidence],
      requires_runtime_test: true,
      recommended_next_scan: ["runtime_cascade_test"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (hasConnections) {
    return makeControlAssessment(FID, "AAI06", "Cascading Failures / Blast Radius", CAT, "unknown", {
      evidence_confidence: 0.5,
      assessment_confidence: 0.3,
      confidence_reason: [
        `${d.inter_agent.mcp_servers.length} MCP server(s) + ${d.inter_agent.connected_agents.length} connected agent(s)`,
        "Circuit-breaker / retry-limit controls not assessable from static discovery",
      ],
      evidence: d.inter_agent.evidence,
      missing_evidence: ["Retry/back-off policy", "Max autonomy chain length"],
      requires_runtime_test: true,
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.inter_agent.collection_status !== "not_collected") {
    return makeControlAssessment(FID, "AAI06", "Cascading Failures / Blast Radius", CAT, "not_observed", {
      evidence_confidence: 0.6,
      assessment_confidence: 0.5,
      confidence_reason: ["No inter-agent chain discovered — cascade risk not applicable"],
      evidence: d.inter_agent.evidence,
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI06", "Cascading Failures / Blast Radius", CAT, "unknown", {
    evidence_confidence: 0.25,
    assessment_confidence: 0.15,
    confidence_reason: ["Inter-agent topology not discovered for this agent"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI07 — Supply Chain & Dependency Risk */
function assessAAI07(d: SecurityDomains): ControlAssessment {
  const hasPublisher = d.supply_chain.publisher.status === "observed";
  const hasFramework = d.supply_chain.framework.status === "observed";
  const hasProvenance = d.supply_chain.artifact_provenance.status === "observed";

  if (!hasPublisher && !hasFramework && !hasProvenance) {
    return makeControlAssessment(FID, "AAI07", "Supply Chain & Dependency Risk", CAT, "unknown", {
      evidence_confidence: 0.2,
      assessment_confidence: 0.15,
      confidence_reason: ["Publisher, framework, and provenance metadata not collected"],
      missing_evidence: ["Dependency graph", "Package/model provenance", "SBOM"],
      limitations: ["Supply chain security requires SBOM/dependency graph, not available from discovery"],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI07", "Supply Chain & Dependency Risk", CAT, "unknown", {
    evidence_confidence: 0.5,
    assessment_confidence: 0.25,
    confidence_reason: [
      hasPublisher ? `Publisher identified: ${d.supply_chain.publisher.value}` : "Publisher not identified",
      hasFramework ? `Framework identified: ${d.supply_chain.framework.value}` : "Framework not identified",
      "Dependency graph and vulnerability scan status not collected",
    ],
    evidence: [...d.supply_chain.publisher.evidence, ...d.supply_chain.framework.evidence],
    missing_evidence: ["Dependency graph", "Vulnerability scan results", "Artifact signing/provenance"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI08 — Data Exfiltration & Sensitive Disclosure */
function assessAAI08(d: SecurityDomains): ControlAssessment {
  const hasSensitiveData = d.data_access.has_pii === true || d.data_access.has_phi === true;
  const internetAccess = d.network.internet_access.value === true;
  const dlpPresent = d.guardrails.output_filtering === true || d.guardrails.data_loss_prevention === true;

  if (hasSensitiveData && internetAccess && !dlpPresent) {
    return makeControlAssessment(FID, "AAI08", "Data Exfiltration & Sensitive Disclosure", CAT, "control_gap", {
      evidence_confidence: 0.8,
      assessment_confidence: 0.6,
      confidence_reason: [
        d.data_access.has_pii ? "PII data access detected" : "",
        d.data_access.has_phi ? "PHI data access detected" : "",
        "Internet egress confirmed active with no output filtering/DLP control detected",
      ].filter(Boolean),
      evidence: [...d.data_access.evidence, ...d.network.internet_access.evidence],
      missing_evidence: ["Egress destination allow-list", "DLP policy", "Runtime exfiltration test"],
      requires_runtime_test: true,
      recommended_next_scan: ["runtime_data_exfiltration_test"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (hasSensitiveData && dlpPresent) {
    return makeControlAssessment(FID, "AAI08", "Data Exfiltration & Sensitive Disclosure", CAT, "not_observed", {
      evidence_confidence: 0.6,
      assessment_confidence: 0.45,
      confidence_reason: ["Sensitive data access present; output filtering/DLP control confirmed"],
      evidence: [...d.data_access.evidence, ...d.guardrails.evidence],
      limitations: ["Controls confirmed present but not runtime-tested for bypass"],
      requires_runtime_test: true,
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.data_access.collection_status === "observed" && !hasSensitiveData) {
    return makeControlAssessment(FID, "AAI08", "Data Exfiltration & Sensitive Disclosure", CAT, "not_observed", {
      evidence_confidence: 0.5,
      assessment_confidence: 0.4,
      confidence_reason: ["No PII/PHI access detected"],
      evidence: d.data_access.evidence,
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI08", "Data Exfiltration & Sensitive Disclosure", CAT, "unknown", {
    evidence_confidence: 0.3,
    assessment_confidence: 0.2,
    confidence_reason: ["Data sensitivity or egress evidence insufficient for assessment"],
    missing_evidence: ["Data classification", "Egress policy"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI09 — Insufficient Human Oversight */
function assessAAI09(d: SecurityDomains): ControlAssessment {
  if (d.human_oversight.collection_status === "unknown") {
    return makeControlAssessment(FID, "AAI09", "Insufficient Human Oversight", CAT, "unknown", {
      evidence_confidence: 0.15,
      assessment_confidence: 0.1,
      confidence_reason: ["Human oversight / autonomy configuration not collected from current plane"],
      missing_evidence: ["Autonomy level", "Human approval requirements"],
      limitations: d.human_oversight.limitations,
      recommended_next_scan: ["copilot_studio_definition_plane", "agent_365_catalog"],
      source_collectors: [primaryCollector(d)],
    });
  }

  const approvalRequired = d.human_oversight.human_approval_required.value === true;
  const approvalAbsent = d.human_oversight.human_approval_required.value === false;
  const canActAutonomously = d.human_oversight.can_execute_without_user === true;

  if (approvalAbsent && canActAutonomously) {
    return makeControlAssessment(FID, "AAI09", "Insufficient Human Oversight", CAT, "detected", {
      evidence_confidence: 0.8,
      assessment_confidence: 0.65,
      confidence_reason: ["Human approval confirmed not required and agent can act without a user present"],
      evidence: d.human_oversight.evidence,
      requires_runtime_test: false,
      source_collectors: [primaryCollector(d)],
    });
  }

  if (approvalRequired) {
    return makeControlAssessment(FID, "AAI09", "Insufficient Human Oversight", CAT, "not_observed", {
      evidence_confidence: 0.6,
      assessment_confidence: 0.45,
      confidence_reason: ["Human approval requirement confirmed present"],
      evidence: d.human_oversight.evidence,
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI09", "Insufficient Human Oversight", CAT, "unknown", {
    evidence_confidence: 0.35,
    assessment_confidence: 0.2,
    confidence_reason: ["Oversight policy partially collected — cannot make a determination"],
    source_collectors: [primaryCollector(d)],
  });
}

/** AAI10 — Observability & Traceability Gaps */
function assessAAI10(d: SecurityDomains): ControlAssessment {
  const loggingKnown = d.guardrails.logging_enabled !== null && d.guardrails.logging_enabled !== undefined;

  if (!loggingKnown && guardrailsUnknown(d)) {
    return makeControlAssessment(FID, "AAI10", "Observability & Traceability Gaps", CAT, "unknown", {
      evidence_confidence: 0.15,
      assessment_confidence: 0.1,
      confidence_reason: ["Audit logging / observability configuration not collected"],
      missing_evidence: ["Audit log configuration", "Action tracing policy"],
      limitations: ["Logging/monitoring configuration lives on definition or runtime plane"],
      recommended_next_scan: ["cloudtrail_check", "azure_monitor_check"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.guardrails.logging_enabled === false) {
    return makeControlAssessment(FID, "AAI10", "Observability & Traceability Gaps", CAT, "control_gap", {
      evidence_confidence: 0.7,
      assessment_confidence: 0.55,
      confidence_reason: ["Audit logging confirmed disabled or not configured for this agent's actions"],
      evidence: d.guardrails.evidence,
      missing_evidence: ["Alert configuration"],
      recommended_next_scan: ["cloudtrail_check", "azure_monitor_check"],
      source_collectors: [primaryCollector(d)],
    });
  }

  if (d.guardrails.logging_enabled === true) {
    return makeControlAssessment(FID, "AAI10", "Observability & Traceability Gaps", CAT, "not_observed", {
      evidence_confidence: 0.65,
      assessment_confidence: 0.5,
      confidence_reason: ["Audit logging confirmed enabled"],
      evidence: d.guardrails.evidence,
      limitations: ["Log completeness/retention not independently verified"],
      source_collectors: [primaryCollector(d)],
    });
  }

  return makeControlAssessment(FID, "AAI10", "Observability & Traceability Gaps", CAT, "unknown", {
    evidence_confidence: 0.3,
    assessment_confidence: 0.2,
    confidence_reason: ["Logging/monitoring status not assessable from available evidence"],
    source_collectors: [primaryCollector(d)],
  });
}

export function runOwaspAiAgents2026(domains: SecurityDomains): Record<string, ControlAssessment> {
  return {
    AAI01: assessAAI01(domains),
    AAI02: assessAAI02(domains),
    AAI03: assessAAI03(domains),
    AAI04: assessAAI04(domains),
    AAI05: assessAAI05(domains),
    AAI06: assessAAI06(domains),
    AAI07: assessAAI07(domains),
    AAI08: assessAAI08(domains),
    AAI09: assessAAI09(domains),
    AAI10: assessAAI10(domains),
  };
}
