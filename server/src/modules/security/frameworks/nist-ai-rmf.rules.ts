// @ts-nocheck
/**
 * nist-ai-rmf.rules.ts
 *
 * NIST AI Risk Management Framework 1.0 — full framework at CATEGORY
 * granularity (19 categories across GOVERN 1-6, MAP 1-5, MEASURE 1-4,
 * MANAGE 1-4). NIST AI RMF's ~72 subcategories are mostly organizational/
 * process controls; representing the framework at category level keeps
 * every category enumerated (full coverage) while staying assessable from
 * technical discovery evidence where evidence exists. Categories with no
 * technical evidence path are explicitly `not_applicable` with a reason,
 * not silently omitted.
 */

import type { ControlAssessment, SecurityDomains } from "../evidence.types";
import { makeControlAssessment, notApplicableGovernanceControl, primaryCollector } from "./control.helpers";

const FID = "nist_ai_rmf";

interface CategoryDef {
  id: string;
  name: string;
  category: string; // NIST function
  evaluate: (d: SecurityDomains) => ControlAssessment;
}

function pc(d: SecurityDomains) {
  return primaryCollector(d);
}

const CATEGORIES: CategoryDef[] = [
  // ── GOVERN ──────────────────────────────────────────────────────────────
  {
    id: "GOVERN-1",
    name: "Legal & Regulatory Alignment",
    category: "GOVERN",
    evaluate: () => notApplicableGovernanceControl(FID, "GOVERN-1", "Legal & Regulatory Alignment", "GOVERN"),
  },
  {
    id: "GOVERN-2",
    name: "Accountability & Ownership Assigned",
    category: "GOVERN",
    evaluate: (d) => {
      const owner = d.identity.owner.value;
      if (owner) {
        return makeControlAssessment(FID, "GOVERN-2", "Accountability & Ownership Assigned", "GOVERN", "not_observed", {
          evidence_confidence: 0.75,
          assessment_confidence: 0.5,
          confidence_reason: [`Agent owner assigned: ${owner}`],
          evidence: d.identity.owner.evidence,
          source_collectors: [pc(d)],
        });
      }
      if (d.identity.owner.status === "unknown") {
        return makeControlAssessment(FID, "GOVERN-2", "Accountability & Ownership Assigned", "GOVERN", "unknown", {
          evidence_confidence: 0.2,
          assessment_confidence: 0.15,
          confidence_reason: ["Owner field not collected"],
          missing_evidence: ["Agent owner / responsible party"],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "GOVERN-2", "Accountability & Ownership Assigned", "GOVERN", "control_gap", {
        evidence_confidence: 0.7,
        assessment_confidence: 0.55,
        confidence_reason: ["Owner field collected and explicitly empty — no accountable owner assigned"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "GOVERN-3",
    name: "Workforce AI Risk Competency",
    category: "GOVERN",
    evaluate: () => notApplicableGovernanceControl(FID, "GOVERN-3", "Workforce AI Risk Competency", "GOVERN"),
  },
  {
    id: "GOVERN-4",
    name: "Organizational Risk Culture",
    category: "GOVERN",
    evaluate: () => notApplicableGovernanceControl(FID, "GOVERN-4", "Organizational Risk Culture", "GOVERN"),
  },
  {
    id: "GOVERN-5",
    name: "Stakeholder Engagement Mechanisms",
    category: "GOVERN",
    evaluate: () => notApplicableGovernanceControl(FID, "GOVERN-5", "Stakeholder Engagement Mechanisms", "GOVERN"),
  },
  {
    id: "GOVERN-6",
    name: "Third-Party & Supply Chain Risk Addressed",
    category: "GOVERN",
    evaluate: (d) => {
      const hasProvenance = d.supply_chain.artifact_provenance.status === "observed";
      const hasPublisher = d.supply_chain.publisher.status === "observed";
      if (hasProvenance || hasPublisher) {
        return makeControlAssessment(FID, "GOVERN-6", "Third-Party & Supply Chain Risk Addressed", "GOVERN", "not_observed", {
          evidence_confidence: 0.5,
          assessment_confidence: 0.3,
          confidence_reason: ["Publisher/provenance metadata collected — partial supply-chain visibility"],
          evidence: [...d.supply_chain.publisher.evidence, ...d.supply_chain.artifact_provenance.evidence],
          limitations: ["Full dependency graph / SBOM not assessed"],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "GOVERN-6", "Third-Party & Supply Chain Risk Addressed", "GOVERN", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.15,
        confidence_reason: ["No publisher, framework, or provenance metadata collected"],
        missing_evidence: ["Publisher", "Artifact provenance", "SBOM"],
        source_collectors: [pc(d)],
      });
    },
  },
  // ── MAP ─────────────────────────────────────────────────────────────────
  {
    id: "MAP-1",
    name: "System Context & Purpose Documented",
    category: "MAP",
    evaluate: (d) => {
      if (d.instructions.present === true) {
        return makeControlAssessment(FID, "MAP-1", "System Context & Purpose Documented", "MAP", "not_observed", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.4,
          confidence_reason: ["System instructions collected — purpose is documented at the instruction layer"],
          evidence: d.instructions.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MAP-1", "System Context & Purpose Documented", "MAP", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["System instructions / purpose statement not available from current collector"],
        missing_evidence: ["System instructions", "Documented intended use"],
        limitations: d.instructions.limitations,
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MAP-2",
    name: "System Categorized by Risk/Impact",
    category: "MAP",
    evaluate: (d) => {
      const sensitive = d.data_access.has_pii === true || d.data_access.has_phi === true;
      if (sensitive) {
        return makeControlAssessment(FID, "MAP-2", "System Categorized by Risk/Impact", "MAP", "control_gap", {
          evidence_confidence: 0.65,
          assessment_confidence: 0.4,
          confidence_reason: ["Agent accesses PII/PHI — should be categorized as elevated-risk, no explicit risk-tier evidence found"],
          evidence: d.data_access.evidence,
          missing_evidence: ["Documented risk-tier classification"],
          source_collectors: [pc(d)],
        });
      }
      if (d.data_access.collection_status === "observed") {
        return makeControlAssessment(FID, "MAP-2", "System Categorized by Risk/Impact", "MAP", "not_observed", {
          evidence_confidence: 0.5,
          assessment_confidence: 0.35,
          confidence_reason: ["No sensitive data access detected — lower risk-tier indicators"],
          evidence: d.data_access.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MAP-2", "System Categorized by Risk/Impact", "MAP", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.15,
        confidence_reason: ["Data sensitivity not assessed"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MAP-3",
    name: "Capabilities & Limitations Characterized",
    category: "MAP",
    evaluate: (d) => {
      if (d.tools.collection_status === "observed") {
        return makeControlAssessment(FID, "MAP-3", "Capabilities & Limitations Characterized", "MAP", "not_observed", {
          evidence_confidence: 0.65,
          assessment_confidence: 0.5,
          confidence_reason: [`Tool inventory collected — ${d.tools.items.length} tool(s) characterized`],
          evidence: [{ fact: `${d.tools.items.length} tool(s) enumerated`, source: pc(d), collection_method: "api" }],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MAP-3", "Capabilities & Limitations Characterized", "MAP", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Tool/capability inventory not available from current collector"],
        missing_evidence: ["Tool inventory"],
        limitations: d.tools.limitations,
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MAP-4",
    name: "Third-Party Resources Mapped",
    category: "MAP",
    evaluate: (d) => {
      const mcpCount = d.inter_agent.mcp_servers.length;
      if (mcpCount > 0 || d.supply_chain.framework.status === "observed") {
        return makeControlAssessment(FID, "MAP-4", "Third-Party Resources Mapped", "MAP", "not_observed", {
          evidence_confidence: 0.55,
          assessment_confidence: 0.35,
          confidence_reason: [`${mcpCount} MCP/third-party connection(s) mapped`],
          evidence: d.inter_agent.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MAP-4", "Third-Party Resources Mapped", "MAP", "unknown", {
        evidence_confidence: 0.25,
        assessment_confidence: 0.15,
        confidence_reason: ["Third-party/dependency mapping not available from current evidence"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MAP-5",
    name: "Impacts to Individuals/Groups Characterized",
    category: "MAP",
    evaluate: (d) => {
      const sensitive = d.data_access.has_pii === true || d.data_access.has_phi === true;
      const oversightUnknown = d.human_oversight.collection_status === "unknown";
      if (sensitive && oversightUnknown) {
        return makeControlAssessment(FID, "MAP-5", "Impacts to Individuals/Groups Characterized", "MAP", "unknown", {
          evidence_confidence: 0.35,
          assessment_confidence: 0.2,
          confidence_reason: ["PII/PHI access present but human-impact oversight controls not collected"],
          missing_evidence: ["Human oversight / autonomy policy"],
          source_collectors: [pc(d)],
        });
      }
      if (!sensitive) {
        return makeControlAssessment(FID, "MAP-5", "Impacts to Individuals/Groups Characterized", "MAP", "not_applicable", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.5,
          confidence_reason: ["No PII/PHI access detected — direct individual impact surface is minimal"],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MAP-5", "Impacts to Individuals/Groups Characterized", "MAP", "control_gap", {
        evidence_confidence: 0.5,
        assessment_confidence: 0.3,
        confidence_reason: ["Sensitive data access present without confirmed human-impact review process"],
        source_collectors: [pc(d)],
      });
    },
  },
  // ── MEASURE ─────────────────────────────────────────────────────────────
  {
    id: "MEASURE-1",
    name: "Trustworthiness Metrics/Methods Identified",
    category: "MEASURE",
    evaluate: (d) => {
      if (d.guardrails.collection_status === "observed") {
        return makeControlAssessment(FID, "MEASURE-1", "Trustworthiness Metrics/Methods Identified", "MEASURE", d.guardrails.present ? "not_observed" : "control_gap", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.4,
          confidence_reason: [d.guardrails.present ? "Guardrail configuration observed" : "Guardrail plane observed — no guardrails configured"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MEASURE-1", "Trustworthiness Metrics/Methods Identified", "MEASURE", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Guardrail/evaluation configuration not collected"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MEASURE-2",
    name: "System Evaluated for Safety & Security",
    category: "MEASURE",
    evaluate: (d) => {
      const promptInjection = d.guardrails.prompt_injection_detection;
      const outputFiltering = d.guardrails.output_filtering;
      if (promptInjection === true || outputFiltering === true) {
        return makeControlAssessment(FID, "MEASURE-2", "System Evaluated for Safety & Security", "MEASURE", "not_observed", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.4,
          confidence_reason: ["Prompt-injection detection and/or output filtering confirmed present"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      if (promptInjection === false && outputFiltering === false) {
        return makeControlAssessment(FID, "MEASURE-2", "System Evaluated for Safety & Security", "MEASURE", "control_gap", {
          evidence_confidence: 0.7,
          assessment_confidence: 0.5,
          confidence_reason: ["Prompt-injection detection and output filtering both confirmed absent"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MEASURE-2", "System Evaluated for Safety & Security", "MEASURE", "unknown", {
        evidence_confidence: 0.25,
        assessment_confidence: 0.15,
        confidence_reason: ["Safety/security evaluation controls not fully collected"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MEASURE-3",
    name: "Risk Tracking Mechanisms in Place",
    category: "MEASURE",
    evaluate: (d) => {
      if (d.guardrails.logging_enabled === true) {
        return makeControlAssessment(FID, "MEASURE-3", "Risk Tracking Mechanisms in Place", "MEASURE", "not_observed", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.45,
          confidence_reason: ["Audit logging confirmed enabled"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.logging_enabled === false) {
        return makeControlAssessment(FID, "MEASURE-3", "Risk Tracking Mechanisms in Place", "MEASURE", "control_gap", {
          evidence_confidence: 0.65,
          assessment_confidence: 0.5,
          confidence_reason: ["Audit logging confirmed disabled or not configured"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MEASURE-3", "Risk Tracking Mechanisms in Place", "MEASURE", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Audit/monitoring configuration not collected"],
        recommended_next_scan: ["cloudtrail_check", "azure_monitor_check"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MEASURE-4",
    name: "Feedback from Affected Communities Evaluated",
    category: "MEASURE",
    evaluate: () => notApplicableGovernanceControl(FID, "MEASURE-4", "Feedback from Affected Communities Evaluated", "MEASURE"),
  },
  // ── MANAGE ──────────────────────────────────────────────────────────────
  {
    id: "MANAGE-1",
    name: "Risks Prioritized & Acted Upon",
    category: "MANAGE",
    evaluate: (d) => {
      const overPermissioned = d.permissions.over_permissioned === true;
      const guardrailsMissing = d.guardrails.present === false;
      if (overPermissioned || guardrailsMissing) {
        return makeControlAssessment(FID, "MANAGE-1", "Risks Prioritized & Acted Upon", "MANAGE", "control_gap", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.4,
          confidence_reason: [
            overPermissioned ? "Over-permissioned condition detected and unmitigated" : "",
            guardrailsMissing ? "No guardrails configured" : "",
          ].filter(Boolean),
          source_collectors: [pc(d)],
        });
      }
      if (d.permissions.collection_status === "observed" && d.guardrails.collection_status === "observed") {
        return makeControlAssessment(FID, "MANAGE-1", "Risks Prioritized & Acted Upon", "MANAGE", "not_observed", {
          evidence_confidence: 0.55,
          assessment_confidence: 0.4,
          confidence_reason: ["No unmitigated over-permissioning or guardrail gaps detected"],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MANAGE-1", "Risks Prioritized & Acted Upon", "MANAGE", "unknown", {
        evidence_confidence: 0.25,
        assessment_confidence: 0.15,
        confidence_reason: ["Insufficient evidence across permission/guardrail domains"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MANAGE-2",
    name: "Resources Allocated to Manage Risk (Rate/Quota Controls)",
    category: "MANAGE",
    evaluate: (d) => {
      if (d.guardrails.rate_limits === true) {
        return makeControlAssessment(FID, "MANAGE-2", "Resources Allocated to Manage Risk (Rate/Quota Controls)", "MANAGE", "not_observed", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.45,
          confidence_reason: ["Rate limiting / quota controls confirmed present"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.rate_limits === false) {
        return makeControlAssessment(FID, "MANAGE-2", "Resources Allocated to Manage Risk (Rate/Quota Controls)", "MANAGE", "control_gap", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.45,
          confidence_reason: ["Rate limiting / quota controls confirmed absent"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MANAGE-2", "Resources Allocated to Manage Risk (Rate/Quota Controls)", "MANAGE", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Rate/quota configuration not collected"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MANAGE-3",
    name: "Third-Party Risks Managed",
    category: "MANAGE",
    evaluate: (d) => {
      if (d.supply_chain.collection_status === "observed") {
        return makeControlAssessment(FID, "MANAGE-3", "Third-Party Risks Managed", "MANAGE", "not_observed", {
          evidence_confidence: 0.5,
          assessment_confidence: 0.35,
          confidence_reason: ["Supply chain/publisher metadata collected"],
          evidence: d.supply_chain.evidence,
          limitations: ["Contractual/ongoing third-party monitoring not assessable from discovery"],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MANAGE-3", "Third-Party Risks Managed", "MANAGE", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Supply chain metadata not collected"],
        source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "MANAGE-4",
    name: "Incident Response & Recovery Plans",
    category: "MANAGE",
    evaluate: (d) => {
      if (d.guardrails.fail_open === true) {
        return makeControlAssessment(FID, "MANAGE-4", "Incident Response & Recovery Plans", "MANAGE", "control_gap", {
          evidence_confidence: 0.65,
          assessment_confidence: 0.5,
          confidence_reason: ["Guardrail fail-open behavior confirmed — agent continues operating when guardrail errors occur"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.fail_open === false) {
        return makeControlAssessment(FID, "MANAGE-4", "Incident Response & Recovery Plans", "MANAGE", "not_observed", {
          evidence_confidence: 0.6,
          assessment_confidence: 0.45,
          confidence_reason: ["Guardrail fail-closed behavior confirmed"],
          evidence: d.guardrails.evidence,
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "MANAGE-4", "Incident Response & Recovery Plans", "MANAGE", "unknown", {
        evidence_confidence: 0.2,
        assessment_confidence: 0.1,
        confidence_reason: ["Failure-mode / incident-handling behavior not collected"],
        source_collectors: [pc(d)],
      });
    },
  },
];

export function runNistAiRmf(domains: SecurityDomains): Record<string, ControlAssessment> {
  const out: Record<string, ControlAssessment> = {};
  for (const c of CATEGORIES) {
    out[c.id] = c.evaluate(domains);
  }
  return out;
}

export const NIST_AI_RMF_CONTROL_COUNT = CATEGORIES.length;
