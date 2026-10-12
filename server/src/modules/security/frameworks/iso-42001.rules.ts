// @ts-nocheck
/**
 * iso-42001.rules.ts
 *
 * ISO/IEC 42001:2023 (AI Management System) — full Annex A control set,
 * organized under the standard's 9 themes (A.2 Policies … A.10 Use of AI
 * systems). As with NIST AI RMF, many Annex A controls are organizational/
 * documentation controls with no technical evidence path; those are
 * enumerated as `not_applicable` so framework coverage remains complete,
 * while controls with a technical evidence path are genuinely assessed.
 */

import type { ControlAssessment, SecurityDomains } from "../evidence.types";
import { makeControlAssessment, notApplicableGovernanceControl, primaryCollector } from "./control.helpers";

const FID = "iso_42001";

interface ControlDef {
  id: string;
  name: string;
  theme: string;
  evaluate: (d: SecurityDomains) => ControlAssessment;
}

function pc(d: SecurityDomains) {
  return primaryCollector(d);
}

const CONTROLS: ControlDef[] = [
  // ── A.2 Policies related to AI ──────────────────────────────────────────
  { id: "A.2.2", name: "AI Policy Established", theme: "Policies", evaluate: () => notApplicableGovernanceControl(FID, "A.2.2", "AI Policy Established", "Policies") },
  { id: "A.2.3", name: "AI Policy Alignment with Other Org Policies", theme: "Policies", evaluate: () => notApplicableGovernanceControl(FID, "A.2.3", "AI Policy Alignment with Other Org Policies", "Policies") },
  { id: "A.2.4", name: "AI Policy Review Process", theme: "Policies", evaluate: () => notApplicableGovernanceControl(FID, "A.2.4", "AI Policy Review Process", "Policies") },

  // ── A.3 Internal organization ───────────────────────────────────────────
  {
    id: "A.3.2", name: "Roles & Responsibilities for AI Assigned", theme: "Internal Organization",
    evaluate: (d) => {
      const owner = d.identity.owner.value;
      if (owner) {
        return makeControlAssessment(FID, "A.3.2", "Roles & Responsibilities for AI Assigned", "Internal Organization", "not_observed", {
          evidence_confidence: 0.7, assessment_confidence: 0.5,
          confidence_reason: [`Responsible owner assigned: ${owner}`],
          evidence: d.identity.owner.evidence, source_collectors: [pc(d)],
        });
      }
      if (d.identity.owner.status === "unknown") {
        return makeControlAssessment(FID, "A.3.2", "Roles & Responsibilities for AI Assigned", "Internal Organization", "unknown", {
          evidence_confidence: 0.2, assessment_confidence: 0.15,
          confidence_reason: ["Owner field not collected"], missing_evidence: ["Responsible owner"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.3.2", "Roles & Responsibilities for AI Assigned", "Internal Organization", "control_gap", {
        evidence_confidence: 0.65, assessment_confidence: 0.5,
        confidence_reason: ["Owner field collected and explicitly empty"], source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.3.3", name: "Reporting of Concerns Process", theme: "Internal Organization", evaluate: () => notApplicableGovernanceControl(FID, "A.3.3", "Reporting of Concerns Process", "Internal Organization") },

  // ── A.4 Resources for AI systems ────────────────────────────────────────
  {
    id: "A.4.2", name: "Compute/Data Resource Inventory Documented", theme: "Resources",
    evaluate: (d) => {
      if (d.model.foundation_model.status === "observed") {
        return makeControlAssessment(FID, "A.4.2", "Compute/Data Resource Inventory Documented", "Resources", "not_observed", {
          evidence_confidence: 0.6, assessment_confidence: 0.4,
          confidence_reason: [`Foundation model identified: ${d.model.foundation_model.value}`],
          evidence: d.model.foundation_model.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.4.2", "Compute/Data Resource Inventory Documented", "Resources", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Underlying model/compute resource not identified from current plane"],
        limitations: d.model.limitations, source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.4.3", name: "Human Resources & AI Literacy", theme: "Resources", evaluate: () => notApplicableGovernanceControl(FID, "A.4.3", "Human Resources & AI Literacy", "Resources") },
  {
    id: "A.4.4", name: "Tooling & System Resources Documented", theme: "Resources",
    evaluate: (d) => {
      if (d.tools.collection_status === "observed") {
        return makeControlAssessment(FID, "A.4.4", "Tooling & System Resources Documented", "Resources", "not_observed", {
          evidence_confidence: 0.65, assessment_confidence: 0.45,
          confidence_reason: [`${d.tools.items.length} tool(s) inventoried`], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.4.4", "Tooling & System Resources Documented", "Resources", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Tool/system resource inventory not available"], limitations: d.tools.limitations, source_collectors: [pc(d)],
      });
    },
  },

  // ── A.5 Assessing impacts of AI systems ─────────────────────────────────
  {
    id: "A.5.2", name: "AI System Impact Assessment Performed", theme: "Impact Assessment",
    evaluate: (d) => {
      const sensitive = d.data_access.has_pii === true || d.data_access.has_phi === true;
      if (sensitive) {
        return makeControlAssessment(FID, "A.5.2", "AI System Impact Assessment Performed", "Impact Assessment", "control_gap", {
          evidence_confidence: 0.6, assessment_confidence: 0.4,
          confidence_reason: ["Agent accesses PII/PHI; no documented impact assessment evidence found"],
          evidence: d.data_access.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.5.2", "AI System Impact Assessment Performed", "Impact Assessment", "not_applicable", {
        evidence_confidence: 0.5, assessment_confidence: 0.4,
        confidence_reason: ["No sensitive data access detected — impact assessment scope limited"], source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.5.3", name: "Impacts on Individuals Assessed", theme: "Impact Assessment", evaluate: () => notApplicableGovernanceControl(FID, "A.5.3", "Impacts on Individuals Assessed", "Impact Assessment") },
  { id: "A.5.4", name: "Societal Impacts Assessed", theme: "Impact Assessment", evaluate: () => notApplicableGovernanceControl(FID, "A.5.4", "Societal Impacts Assessed", "Impact Assessment") },
  {
    id: "A.5.5", name: "Risk Treatment Documented", theme: "Impact Assessment",
    evaluate: (d) => {
      const overPermissioned = d.permissions.over_permissioned === true;
      const guardrailsMissing = d.guardrails.present === false;
      if (overPermissioned || guardrailsMissing) {
        return makeControlAssessment(FID, "A.5.5", "Risk Treatment Documented", "Impact Assessment", "control_gap", {
          evidence_confidence: 0.6, assessment_confidence: 0.4,
          confidence_reason: ["Identified risk condition(s) present without confirmed mitigation"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.5.5", "Risk Treatment Documented", "Impact Assessment", "unknown", {
        evidence_confidence: 0.3, assessment_confidence: 0.15,
        confidence_reason: ["Insufficient evidence to assess risk treatment status"], source_collectors: [pc(d)],
      });
    },
  },

  // ── A.6 AI system life cycle ────────────────────────────────────────────
  {
    id: "A.6.1.2", name: "System Design Objectives Documented", theme: "AI System Life Cycle",
    evaluate: (d) => {
      if (d.instructions.present === true) {
        return makeControlAssessment(FID, "A.6.1.2", "System Design Objectives Documented", "AI System Life Cycle", "not_observed", {
          evidence_confidence: 0.55, assessment_confidence: 0.35,
          confidence_reason: ["System instructions collected — objectives documented at instruction layer"],
          evidence: d.instructions.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.6.1.2", "System Design Objectives Documented", "AI System Life Cycle", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Instructions/design objectives not available from current collector"],
        limitations: d.instructions.limitations, source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.6.1.3", name: "Verification & Validation Procedures", theme: "AI System Life Cycle", evaluate: () => notApplicableGovernanceControl(FID, "A.6.1.3", "Verification & Validation Procedures", "AI System Life Cycle") },
  {
    id: "A.6.2.2", name: "Deployment Configuration Documented", theme: "AI System Life Cycle",
    evaluate: (d) => {
      if (d.model.endpoint.status === "observed") {
        return makeControlAssessment(FID, "A.6.2.2", "Deployment Configuration Documented", "AI System Life Cycle", "not_observed", {
          evidence_confidence: 0.55, assessment_confidence: 0.4,
          confidence_reason: ["Deployment endpoint identified"], evidence: d.model.endpoint.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.6.2.2", "Deployment Configuration Documented", "AI System Life Cycle", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Deployment endpoint/configuration not collected"], source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "A.6.2.3", name: "Change Management Process Evidenced", theme: "AI System Life Cycle",
    evaluate: (d) => {
      if (d.guardrails.change_management_detected === true) {
        return makeControlAssessment(FID, "A.6.2.3", "Change Management Process Evidenced", "AI System Life Cycle", "not_observed", {
          evidence_confidence: 0.6, assessment_confidence: 0.4,
          confidence_reason: ["Change-management signal (versioning/approval workflow) detected"],
          evidence: d.guardrails.evidence, source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.change_management_detected === false) {
        return makeControlAssessment(FID, "A.6.2.3", "Change Management Process Evidenced", "AI System Life Cycle", "control_gap", {
          evidence_confidence: 0.5, assessment_confidence: 0.35,
          confidence_reason: ["No change-management signal detected for this agent"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.6.2.3", "Change Management Process Evidenced", "AI System Life Cycle", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Change-management evidence not collected"], source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.6.2.4", name: "Decommissioning Procedures", theme: "AI System Life Cycle", evaluate: () => notApplicableGovernanceControl(FID, "A.6.2.4", "Decommissioning Procedures", "AI System Life Cycle") },
  {
    id: "A.6.2.5", name: "Incident/Event Logging in Place", theme: "AI System Life Cycle",
    evaluate: (d) => {
      if (d.guardrails.logging_enabled === true) {
        return makeControlAssessment(FID, "A.6.2.5", "Incident/Event Logging in Place", "AI System Life Cycle", "not_observed", {
          evidence_confidence: 0.6, assessment_confidence: 0.45,
          confidence_reason: ["Audit logging confirmed enabled"], evidence: d.guardrails.evidence, source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.logging_enabled === false) {
        return makeControlAssessment(FID, "A.6.2.5", "Incident/Event Logging in Place", "AI System Life Cycle", "control_gap", {
          evidence_confidence: 0.65, assessment_confidence: 0.5,
          confidence_reason: ["Audit logging confirmed disabled or not configured"], evidence: d.guardrails.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.6.2.5", "Incident/Event Logging in Place", "AI System Life Cycle", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Logging configuration not collected"], recommended_next_scan: ["cloudtrail_check", "azure_monitor_check"], source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.6.2.6", name: "Continuous Monitoring of Performance", theme: "AI System Life Cycle", evaluate: () => notApplicableGovernanceControl(FID, "A.6.2.6", "Continuous Monitoring of Performance", "AI System Life Cycle") },

  // ── A.7 Data for AI systems ──────────────────────────────────────────────
  {
    id: "A.7.2", name: "Data Sources Documented", theme: "Data",
    evaluate: (d) => {
      if (d.data_access.data_sources.length > 0 || d.memory.knowledge_bases.length > 0) {
        return makeControlAssessment(FID, "A.7.2", "Data Sources Documented", "Data", "not_observed", {
          evidence_confidence: 0.55, assessment_confidence: 0.4,
          confidence_reason: [`${d.data_access.data_sources.length} data source(s) / ${d.memory.knowledge_bases.length} knowledge base(s) documented`],
          source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.7.2", "Data Sources Documented", "Data", "unknown", {
        evidence_confidence: 0.25, assessment_confidence: 0.15,
        confidence_reason: ["Data source inventory not available from current evidence"], source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "A.7.3", name: "Data Quality Requirements Met", theme: "Data",
    evaluate: () => makeControlAssessment(FID, "A.7.3", "Data Quality Requirements Met", "Data", "unknown", {
      evidence_confidence: 0.15, assessment_confidence: 0.1,
      confidence_reason: ["Data quality/lineage requires source-system access not available from discovery"], source_collectors: ["system"],
    }),
  },
  {
    id: "A.7.4", name: "Data Protection Controls (Encryption)", theme: "Data",
    evaluate: (d) => {
      if (d.guardrails.encryption_at_rest === true) {
        return makeControlAssessment(FID, "A.7.4", "Data Protection Controls (Encryption)", "Data", "not_observed", {
          evidence_confidence: 0.65, assessment_confidence: 0.5,
          confidence_reason: ["Encryption-at-rest confirmed"], evidence: d.guardrails.evidence, source_collectors: [pc(d)],
        });
      }
      if (d.guardrails.encryption_at_rest === false) {
        return makeControlAssessment(FID, "A.7.4", "Data Protection Controls (Encryption)", "Data", "detected", {
          evidence_confidence: 0.7, assessment_confidence: 0.55,
          confidence_reason: ["Encryption-at-rest confirmed absent for data accessed by this agent"], evidence: d.guardrails.evidence, source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.7.4", "Data Protection Controls (Encryption)", "Data", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Encryption configuration not collected"], recommended_next_scan: ["kms_check", "key_vault_check"], source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "A.7.5", name: "Data Access Controls Enforced", theme: "Data",
    evaluate: (d) => {
      if (d.permissions.over_permissioned === true) {
        return makeControlAssessment(FID, "A.7.5", "Data Access Controls Enforced", "Data", "detected", {
          evidence_confidence: 0.7, assessment_confidence: 0.55,
          confidence_reason: ["Agent is over-permissioned relative to declared data access needs"],
          evidence: d.permissions.evidence, source_collectors: [pc(d)],
        });
      }
      if (d.permissions.collection_status === "observed") {
        return makeControlAssessment(FID, "A.7.5", "Data Access Controls Enforced", "Data", "not_observed", {
          evidence_confidence: 0.55, assessment_confidence: 0.4,
          confidence_reason: ["Permission analysis ran; no over-permissioning detected"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.7.5", "Data Access Controls Enforced", "Data", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Permission/access-control evidence not collected"], source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.7.6", name: "Data Retention & Disposal Policy", theme: "Data", evaluate: () => notApplicableGovernanceControl(FID, "A.7.6", "Data Retention & Disposal Policy", "Data") },

  // ── A.8 Information for interested parties ──────────────────────────────
  {
    id: "A.8.2", name: "System Documentation Available to Users", theme: "Information for Interested Parties",
    evaluate: (d) => (d.instructions.present === true
      ? makeControlAssessment(FID, "A.8.2", "System Documentation Available to Users", "Information for Interested Parties", "not_observed", {
          evidence_confidence: 0.5, assessment_confidence: 0.35,
          confidence_reason: ["System instructions available — baseline documentation exists"], source_collectors: [pc(d)],
        })
      : makeControlAssessment(FID, "A.8.2", "System Documentation Available to Users", "Information for Interested Parties", "unknown", {
          evidence_confidence: 0.2, assessment_confidence: 0.1,
          confidence_reason: ["System documentation/instructions not available"], source_collectors: [pc(d)],
        })),
  },
  { id: "A.8.3", name: "Communication of AI Use to Affected Parties", theme: "Information for Interested Parties", evaluate: () => notApplicableGovernanceControl(FID, "A.8.3", "Communication of AI Use to Affected Parties", "Information for Interested Parties") },
  { id: "A.8.4", name: "Complaint/Appeal Mechanism", theme: "Information for Interested Parties", evaluate: () => notApplicableGovernanceControl(FID, "A.8.4", "Complaint/Appeal Mechanism", "Information for Interested Parties") },

  // ── A.9 Use of AI systems ────────────────────────────────────────────────
  {
    id: "A.9.2", name: "Intended Use Constraints Enforced", theme: "Use of AI Systems",
    evaluate: (d) => {
      const stateTools = d.tools.items.filter((t) => t.risk_flags.can_modify_state);
      const approvalAbsent = stateTools.filter((t) => t.requires_human_approval === false);
      if (approvalAbsent.length > 0) {
        return makeControlAssessment(FID, "A.9.2", "Intended Use Constraints Enforced", "Use of AI Systems", "control_gap", {
          evidence_confidence: 0.65, assessment_confidence: 0.45,
          confidence_reason: [`${approvalAbsent.length} state-modifying tool(s) require no human approval`],
          related_tools: approvalAbsent.map((t) => t.name ?? "unknown"), source_collectors: [pc(d)],
        });
      }
      if (d.tools.collection_status === "observed") {
        return makeControlAssessment(FID, "A.9.2", "Intended Use Constraints Enforced", "Use of AI Systems", "not_observed", {
          evidence_confidence: 0.55, assessment_confidence: 0.4,
          confidence_reason: ["No unconstrained state-modifying tools detected"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.9.2", "Intended Use Constraints Enforced", "Use of AI Systems", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1,
        confidence_reason: ["Tool/use-constraint evidence not collected"], limitations: d.tools.limitations, source_collectors: [pc(d)],
      });
    },
  },
  {
    id: "A.9.3", name: "Human Oversight of AI Use", theme: "Use of AI Systems",
    evaluate: (d) => {
      if (d.human_oversight.collection_status === "unknown") {
        return makeControlAssessment(FID, "A.9.3", "Human Oversight of AI Use", "Use of AI Systems", "unknown", {
          evidence_confidence: 0.2, assessment_confidence: 0.1,
          confidence_reason: ["Human oversight configuration not collected"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.9.3", "Human Oversight of AI Use", "Use of AI Systems",
        d.human_oversight.human_approval_required.value === true ? "not_observed" : "control_gap", {
        evidence_confidence: 0.55, assessment_confidence: 0.4,
        confidence_reason: [d.human_oversight.human_approval_required.value === true
          ? "Human approval requirement confirmed"
          : "Human approval requirement not confirmed"],
        evidence: d.human_oversight.evidence, source_collectors: [pc(d)],
      });
    },
  },
  { id: "A.9.4", name: "Records of AI System Use Maintained", theme: "Use of AI Systems", evaluate: (d) => (d.guardrails.logging_enabled === true
    ? makeControlAssessment(FID, "A.9.4", "Records of AI System Use Maintained", "Use of AI Systems", "not_observed", {
        evidence_confidence: 0.55, assessment_confidence: 0.4, confidence_reason: ["Usage logging confirmed enabled"], source_collectors: [pc(d)],
      })
    : makeControlAssessment(FID, "A.9.4", "Records of AI System Use Maintained", "Use of AI Systems", "unknown", {
        evidence_confidence: 0.2, assessment_confidence: 0.1, confidence_reason: ["Usage record/logging evidence not collected"], source_collectors: [pc(d)],
      })) },

  // ── A.10 Third-party and customer relationships ─────────────────────────
  {
    id: "A.10.2", name: "Third-Party AI Component Risks Assessed", theme: "Third-Party & Customer Relationships",
    evaluate: (d) => (d.supply_chain.collection_status === "observed"
      ? makeControlAssessment(FID, "A.10.2", "Third-Party AI Component Risks Assessed", "Third-Party & Customer Relationships", "not_observed", {
          evidence_confidence: 0.5, assessment_confidence: 0.35,
          confidence_reason: ["Supply chain/publisher metadata collected"], evidence: d.supply_chain.evidence, source_collectors: [pc(d)],
        })
      : makeControlAssessment(FID, "A.10.2", "Third-Party AI Component Risks Assessed", "Third-Party & Customer Relationships", "unknown", {
          evidence_confidence: 0.2, assessment_confidence: 0.1,
          confidence_reason: ["Supply chain metadata not collected"], source_collectors: [pc(d)],
        })),
  },
  { id: "A.10.3", name: "Contractual AI Requirements with Third Parties", theme: "Third-Party & Customer Relationships", evaluate: () => notApplicableGovernanceControl(FID, "A.10.3", "Contractual AI Requirements with Third Parties", "Third-Party & Customer Relationships") },
  {
    id: "A.10.4", name: "MCP/Inter-Agent Trust Boundaries Enforced", theme: "Third-Party & Customer Relationships",
    evaluate: (d) => {
      const mcpServers = d.inter_agent.mcp_servers;
      const unauthed = mcpServers.filter((m) => m.auth_present === false);
      if (unauthed.length > 0) {
        return makeControlAssessment(FID, "A.10.4", "MCP/Inter-Agent Trust Boundaries Enforced", "Third-Party & Customer Relationships", "detected", {
          evidence_confidence: 0.75, assessment_confidence: 0.6,
          confidence_reason: [`${unauthed.length} MCP server(s) confirmed unauthenticated`], related_assets: unauthed.map((m) => m.name ?? m.endpoint ?? "unknown"),
          source_collectors: [pc(d)],
        });
      }
      if (mcpServers.length === 0) {
        return makeControlAssessment(FID, "A.10.4", "MCP/Inter-Agent Trust Boundaries Enforced", "Third-Party & Customer Relationships", "not_applicable", {
          evidence_confidence: 0.6, assessment_confidence: 0.5,
          confidence_reason: ["No inter-agent/MCP connections discovered"], source_collectors: [pc(d)],
        });
      }
      return makeControlAssessment(FID, "A.10.4", "MCP/Inter-Agent Trust Boundaries Enforced", "Third-Party & Customer Relationships", "not_observed", {
        evidence_confidence: 0.5, assessment_confidence: 0.35,
        confidence_reason: [`${mcpServers.length} MCP server(s) found; authentication confirmed present`], source_collectors: [pc(d)],
      });
    },
  },
];

export function runIso42001(domains: SecurityDomains): Record<string, ControlAssessment> {
  const out: Record<string, ControlAssessment> = {};
  for (const c of CONTROLS) {
    out[c.id] = c.evaluate(domains);
  }
  return out;
}

export const ISO_42001_CONTROL_COUNT = CONTROLS.length;
