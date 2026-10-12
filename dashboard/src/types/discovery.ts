export interface DiscoveredAgent {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
  cloud_provider: string | null;
  region: string | null;
  fingerprint: string | null;
  owner: string | null;
  department: string | null;
  business_unit: string | null;
  repository: string | null;
  deployment_type: string | null;
  confidence_score: number | null;
  created_at: string;
  status: string;
  agent_status: string | null;
  
  // Security flags
  api_keys_detected: boolean;
  secrets_detected: boolean;
  internet_access: boolean;
  filesystem_access: boolean;
  database_access: boolean;
  github_access: boolean;
  slack_access: boolean;
  email_access: boolean;
  calendar_access: boolean;
  browser_access: boolean;
  
  // JSONB / Arrays
  mcp_connections: any[];
  tools: any[];
  prompt_templates: any[];
  connected_applications: any[];
  permissions: any[];
  risk_indicators: string[];
  source_collectors: string[];
  metadata: any;
  agent_config: any;
  agent_access: any;
  ownership: any;
  data_access_classification: any;
  mesh: any;
  
  // Other fields
  scan_id: string | null;
  integration_id: string | null;
  how_identified: string | null;
  evidence_reason: string | null;
  evidence_class: string | null;
  updated_at: string;
  
  requested_status?: string | null;
  previous_status?: string | null;
  request_remark?: string | null;
  approval_remark?: string | null;
  findings?: ScanFinding[];
  risk_score?: number | null;
  riskScoreBreakdown?: RiskScoreBreakdown | null;
}

export interface RiskFactor {
  name: string;
  points: number;
  applied: boolean;
}

export interface RiskScoreBreakdown {
  rawScore: number;
  finalScore: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  components: {
    intrinsicAttackSurface: {
      score: number;
      max: number;
      factors: RiskFactor[];
    };
    governanceDeficits: {
      score: number;
      max: number;
      factors: RiskFactor[];
    };
    owaspVulnerabilities: {
      score: number;
      max: number;
      factors: RiskFactor[];
    };
    unknownMultiplier: {
      applied: boolean;
      multiplier: number;
      reason: string | null;
    };
  };
}

export interface ScanFinding {
  finding_type: string;
  severity: 'info' | 'risk' | 'critical';
  details: any;
  created_at: string;
}

export interface AgentFilters {
  models: string[];
  providers: string[];
  owners: string[];
  types: string[];
  statuses: string[];
}

export interface DiscoveredModel {
  id: string;
  tenant_id: string | null;
  name: string;
  display_name: string | null;
  provider: string | null;
  model_type: string;
  version: string | null;
  family: string | null;
  validation_status: 'pending' | 'approved' | 'flagged' | 'deprecated' | 'under_review';
  risk_level: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  agent_count: number;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  capabilities: any;
  metadata: any;
  created_at: string;
  updated_at: string;
  requested_status: string | null;
  previous_status: string | null;
}

export interface ModelFilters {
  providers: string[];
  statuses: string[];
  riskLevels: string[];
}

// ── Multi-Framework Assessment Types ───────────────────────────────────────────
// Agents are testified against OWASP AI Agents 2026, NIST AI RMF, and
// ISO/IEC 42001. All three frameworks share this same control shape so the
// UI can render them uniformly.

export type AssessmentStatus = 'detected' | 'not_observed' | 'unknown' | 'not_applicable' | 'control_gap';

export interface ControlAssessment {
  framework_id: string;
  control_id: string;
  /** @deprecated alias of control_id */
  id: string;
  name: string;
  category: string;
  status: AssessmentStatus;
  evidence_confidence: number;
  assessment_confidence: number;
  confidence_reason: string[];
  assessment_type: 'configuration' | 'discovery' | 'runtime' | 'heuristic';
  evidence: Array<{ fact: string; source: string; collection_method?: string; collected_at?: string | null }>;
  missing_evidence: string[];
  limitations: string[];
  related_assets: string[];
  related_tools: string[];
  source_collectors: string[];
  last_assessed: string;
  requires_runtime_test: boolean;
  recommended_next_scan: string[];
}

/** @deprecated use ControlAssessment */
export type OWASPCategoryAssessment = ControlAssessment;

export interface FrameworkMeta {
  id: string;
  name: string;
  version: string;
  controlCount: number;
  category: 'Security' | 'Regulation' | 'Standard';
  description: string;
}

export interface FrameworkAssessment {
  meta: FrameworkMeta;
  controls: Record<string, ControlAssessment>;
}

export interface EvidenceCompleteness {
  overall: number;
  identity: number;
  model: number;
  instructions: number;
  tools: number;
  permissions: number;
  data_access: number;
  network: number;
  memory: number;
  guardrails: number;
  human_oversight: number;
  inter_agent: number;
  supply_chain: number;
  runtime: number;
}

export interface SecurityAssessment {
  schema_version: string;
  assessment_time: string;
  evidence_sources: string[];
  domains: any;
  /** Keyed by framework id: "owasp_ai_agents_2026" | "nist_ai_rmf" | "iso_42001" */
  frameworks: Record<string, FrameworkAssessment>;
  evidence_completeness: EvidenceCompleteness;
  runtime_tests: any[];
  drift?: any[];
}

export interface AgentControlReviewRow {
  agentId: string;
  name: string;
  type: string | null;
  posture: 'compliant' | 'partial' | 'non_compliant' | 'unassessed';
  score: number;
  pass: number;
  partial: number;
  fail: number;
  evidenceTags: string[];
}

