// @ts-nocheck
/**
 * control.helpers.ts
 *
 * Shared helpers used by every framework rule file (OWASP AI Agents 2026,
 * NIST AI RMF, ISO/IEC 42001, ...) to build ControlAssessment objects and
 * to read common evidence conditions off SecurityDomains.
 *
 * Design principles (shared across all frameworks):
 *  - Rules use the normalized SecurityDomains, NEVER raw agent fields
 *  - A rule only produces "detected" when there is positive evidence
 *  - "not_observed" is produced only when the relevant domain was actually
 *    collected and the risk condition was absent
 *  - "unknown" is produced when evidence is insufficient to assess
 *  - "not_applicable" is used for controls outside discovery's technical
 *    reach (organizational/process controls) — the control is still
 *    enumerated so framework coverage stays complete
 */

import type { ControlAssessment, SecurityDomains, AssessmentStatus, EvidenceFact } from "../evidence.types";

function nowIso(): string {
  return new Date().toISOString();
}

export interface AssessmentOpts {
  confidence?: number;
  evidence_confidence?: number;
  assessment_confidence?: number;
  confidence_reason: string[];
  evidence?: EvidenceFact[];
  missing_evidence?: string[];
  limitations?: string[];
  related_tools?: string[];
  related_assets?: string[];
  source_collectors?: string[];
  requires_runtime_test?: boolean;
  recommended_next_scan?: string[];
  assessment_type?: ControlAssessment["assessment_type"];
}

export function makeControlAssessment(
  frameworkId: string,
  controlId: string,
  name: string,
  category: string,
  status: AssessmentStatus,
  opts: AssessmentOpts,
): ControlAssessment {
  const evConf = opts.evidence_confidence ?? opts.confidence ?? 0.5;
  const asConf = opts.assessment_confidence ?? opts.confidence ?? 0.5;
  return {
    framework_id: frameworkId,
    control_id: controlId,
    id: controlId,
    name,
    category,
    status,
    evidence_confidence: evConf,
    assessment_confidence: asConf,
    confidence_reason: opts.confidence_reason,
    assessment_type: opts.assessment_type ?? "configuration",
    evidence: opts.evidence ?? [],
    missing_evidence: opts.missing_evidence ?? [],
    limitations: opts.limitations ?? [],
    related_assets: opts.related_assets ?? [],
    related_tools: opts.related_tools ?? [],
    source_collectors: opts.source_collectors ?? [],
    last_assessed: nowIso(),
    requires_runtime_test: opts.requires_runtime_test ?? false,
    recommended_next_scan: opts.recommended_next_scan ?? [],
  };
}

/** Standard "control outside technical discovery scope" result for governance frameworks */
export function notApplicableGovernanceControl(
  frameworkId: string,
  controlId: string,
  name: string,
  category: string,
): ControlAssessment {
  return makeControlAssessment(frameworkId, controlId, name, category, "not_applicable", {
    evidence_confidence: 0.9,
    assessment_confidence: 0.9,
    confidence_reason: [
      "This is an organizational/process/documentation control",
      "Not observable from technical agent discovery evidence",
    ],
    limitations: ["Requires policy/documentation review, not infrastructure discovery"],
    source_collectors: ["system"],
  });
}

// ─── Common evidence predicates (reused across framework rule files) ────────

export function toolsFullyCollected(d: SecurityDomains): boolean {
  return d.tools.collection_status === "observed";
}

export function toolsUnavailable(d: SecurityDomains): boolean {
  return (
    d.tools.collection_status === "not_collected" ||
    d.tools.collection_status === "unknown" ||
    d.tools.collection_status === "permission_denied" ||
    d.tools.collection_status === "error"
  );
}

export function instructionsUnavailable(d: SecurityDomains): boolean {
  return (
    d.instructions.collection_status === "unknown" ||
    d.instructions.collection_status === "not_collected"
  );
}

export function hasStateModifyingTool(d: SecurityDomains): boolean {
  return d.tools.items.some((t) => t.risk_flags.can_modify_state);
}

export function hasCodeExecutionTool(d: SecurityDomains): boolean {
  return d.tools.items.some((t) => t.risk_flags.can_execute_code);
}

export function hasPiiExposedTool(d: SecurityDomains): boolean {
  return d.tools.items.some((t) => t.risk_flags.can_access_pii || t.risk_flags.can_access_phi);
}

export function guardrailsMissing(d: SecurityDomains): boolean {
  return d.guardrails.present === false && d.guardrails.collection_status !== "unknown";
}

export function guardrailsUnknown(d: SecurityDomains): boolean {
  return d.guardrails.collection_status === "unknown" || d.guardrails.present === null;
}

export function primaryCollector(d: SecurityDomains): string {
  return d.identity.object_id.source ?? "unknown";
}
