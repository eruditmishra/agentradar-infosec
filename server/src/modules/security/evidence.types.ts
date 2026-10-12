/**
 * evidence.types.ts
 *
 * Core type definitions for the Agent Radar OWASP evidence-based
 * security assessment system.
 *
 * Design principles:
 *  - All assessment statuses are explicit: observed | not_observed |
 *    unknown | not_collected | not_applicable
 *  - "not_observed" never automatically means "secure"
 *  - Every OWASP assessment includes confidence in the assessment state
 *    (not in the security outcome)
 *  - Evidence chains are always traceable to source collector + timestamp
 */

// ─── Evidence Status ──────────────────────────────────────────────────────────

/**
 * The collection/observation status of a security-relevant property.
 *
 * observed      – property was actively observed (value present)
 * not_observed  – collector ran successfully and found nothing
 *                 (does NOT imply secure)
 * unknown       – cannot determine: collector did not / could not collect
 * not_collected – not yet collected (scanner gap; future collection planned)
 * not_applicable – property is structurally irrelevant for this agent type
 */
export type EvidenceStatus =
  | "observed"
  | "not_observed"
  | "unknown"
  | "not_collected"
  | "unsupported"
  | "permission_denied"
  | "error"
  | "not_applicable";

// ─── Assessment Status ────────────────────────────────────────────────────────

/**
 * The OWASP finding status for a specific category.
 *
 * detected      – a concrete risk condition was found
 * not_observed  – evidence was collected and no risk condition was found
 *                 (limited scope; not a guarantee)
 * unknown       – insufficient evidence to assess (most common for cloud agents)
 * not_applicable – the category is not relevant for this agent type
 */
export type AssessmentStatus =
  | "detected"
  | "control_gap"
  | "not_observed"
  | "unknown"
  | "not_applicable";

// ─── Assessment Type ──────────────────────────────────────────────────────────

export type AssessmentType =
  | "configuration"   // based on declared config / policy
  | "discovery"       // based on what was discovered
  | "runtime"         // based on actual runtime test results
  | "heuristic";      // based on pattern matching / inference

// ─── Evidence Item ────────────────────────────────────────────────────────────

/**
 * A single piece of collected evidence.
 * Used inside domain objects and OWASP assessment findings.
 */
export interface EvidenceFact {
  /** The evidence statement / observation */
  fact: string;
  /** Which collector/source produced this */
  source: string;
  /** How it was collected */
  collection_method?: "api" | "config" | "heuristic" | "runtime" | "inferred";
  /** When it was collected */
  collected_at?: string | null;
}

/**
 * Reusable evidence wrapper for a single security property.
 */
export interface EvidenceItem<T = unknown> {
  value: T | null;
  status: EvidenceStatus;
  source: string | null;
  collection_method?: "api" | "config" | "heuristic" | "runtime" | "inferred";
  collected_at?: string | null;
  confidence: number;        // 0.0–1.0
  evidence: EvidenceFact[];
  limitations: string[];
}

// ─── Tool Evidence ────────────────────────────────────────────────────────────

export interface ToolEvidence {
  /** Collector status for the tools collection */
  collection_status: EvidenceStatus;
  /** Why collection was not available (when collection_status = not_available) */
  collection_unavailable_reason?: string | null;
  /** Which source the tools came from */
  source: string | null;
  /** The discovered tools */
  items: ToolItem[];
  /** Any limitations on the tool collection */
  limitations: string[];
}

export interface ToolItem {
  id?: string | null;
  name: string | null;
  description: string | null;
  type?: string | null;
  source: string | null;
  operations?: string[];        // ["read", "write", "delete"]
  permissions?: string[];
  risk_flags: {
    can_execute_code: boolean;
    can_access_pii: boolean;
    can_access_phi: boolean;
    can_modify_state: boolean;
    can_call_external_apis: boolean;
    can_access_filesystem: boolean;
    can_access_secrets: boolean;
  };
  requires_human_approval?: boolean | null;
  internet_exposed?: boolean | null;
  data_classes?: string[];
  confidence: "low" | "medium" | "high";
  evidence: EvidenceFact[];
}

// ─── Security Domains ─────────────────────────────────────────────────────────

export interface IdentityDomain {
  collection_status: EvidenceStatus;
  agent_id: EvidenceItem<string>;
  object_id: EvidenceItem<string>;
  app_id: EvidenceItem<string>;
  tenant_id: EvidenceItem<string>;
  service_principal_type: EvidenceItem<string>;
  principal_id: EvidenceItem<string>;
  owner: EvidenceItem<string>;
  owner_organization: EvidenceItem<string>;
  lifecycle_status: EvidenceItem<string>;
  created_at: EvidenceItem<string>;
  modified_at: EvidenceItem<string>;
  identity_type: EvidenceItem<string>;
  account_enabled: EvidenceItem<boolean>;
}

export interface ModelDomain {
  collection_status: EvidenceStatus;
  name: EvidenceItem<string>;
  provider: EvidenceItem<string>;
  version: EvidenceItem<string | null>;
  foundation_model: EvidenceItem<string>;
  endpoint: EvidenceItem<string>;
  verified: boolean;
  /** True if the "model" field is just an identity label, not the actual LLM */
  is_identity_placeholder: boolean;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface InstructionsDomain {
  collection_status: EvidenceStatus;
  present: boolean | null;
  hash: string | null;
  length: number | null;
  source: string | null;
  last_modified: string | null;
  /** Derived semantic flags (from content analysis, not full text storage) */
  contains_safety_rules: boolean | null;
  contains_tool_guidance: boolean | null;
  contains_data_handling_rules: boolean | null;
  contains_identity_constraints: boolean | null;
  contains_output_constraints: boolean | null;
  contains_external_data_instructions: boolean | null;
  /** Why instructions are not available (when collection_status = unknown) */
  unavailable_reason?: string | null;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface PermissionsDomain {
  collection_status: EvidenceStatus;
  declared_permissions: string[];
  application_permissions: EvidenceItem<string[]>;
  delegated_permissions: EvidenceItem<string[]>;
  rbac_roles: EvidenceItem<string[]>;
  managed_identity_permissions: EvidenceItem<string[]>;
  /** Derived risk conditions (only set when evidence supports) */
  over_permissioned: boolean | null;
  privileged: boolean | null;
  write_capable: boolean | null;
  delete_capable: boolean | null;
  admin_capable: boolean | null;
  cross_tenant: boolean | null;
  credential_exposure_risk: "unknown" | "low" | "medium" | "high";
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface DataAccessDomain {
  collection_status: EvidenceStatus;
  /** Known data sources accessed */
  data_sources: DataSourceRef[];
  has_pii: boolean | null;
  has_phi: boolean | null;
  data_classes: string[];
  database_access: EvidenceItem<boolean>;
  email_access: EvidenceItem<boolean>;
  calendar_access: EvidenceItem<boolean>;
  github_access: EvidenceItem<boolean>;
  slack_access: EvidenceItem<boolean>;
  filesystem_access: EvidenceItem<boolean>;
  external_transfer_assessed: boolean;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface DataSourceRef {
  name: string | null;
  type: string | null;
  classification: string | null;  // "PII", "PHI", "financial", "public"
  access: string[];
  external_transfer_allowed: boolean | null;
  evidence: EvidenceFact[];
}

export interface NetworkDomain {
  collection_status: EvidenceStatus;
  internet_access: EvidenceItem<boolean>;
  inbound_access: EvidenceItem<boolean>;
  outbound_access: EvidenceItem<boolean>;
  public_endpoint: EvidenceItem<string>;
  private_endpoint: EvidenceItem<string>;
  unrestricted_egress: boolean | null;
  browser_access: EvidenceItem<boolean>;
  allowed_domains: string[];
  known_external_destinations: string[];
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface MemoryDomain {
  collection_status: EvidenceStatus;
  has_memory: boolean | null;
  memory_type: string | null;
  persistent_memory: EvidenceItem<boolean>;
  vector_stores: MemoryStoreRef[];
  knowledge_bases: MemoryStoreRef[];
  /** Can the agent write to its own memory? */
  write_capability: EvidenceItem<boolean>;
  /** Can the agent delete from its own memory? */
  delete_capability: EvidenceItem<boolean>;
  rag_configured: boolean | null;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface MemoryStoreRef {
  id: string | null;
  name: string | null;
  type: string | null;
  sensitivity: string | null;
  access_level: string | null;
  evidence: EvidenceFact[];
}

export interface GuardrailsDomain {
  collection_status: EvidenceStatus;
  present: boolean | null;
  guardrail_id: string | null;
  prompt_injection_detection: boolean | null;
  output_filtering: boolean | null;
  pii_detection: boolean | null;
  phi_detection: boolean | null;
  content_filtering: boolean | null;
  tool_policy: boolean | null;
  data_loss_prevention: boolean | null;
  rate_limits: boolean | null;
  sandboxing: boolean | null;
  /** fail-open = agent continues even when guardrail errors */
  fail_open: boolean | null;
  /** Audit/action logging enabled (CloudTrail / Azure Activity Log / equivalent) */
  logging_enabled: boolean | null;
  /** Data-at-rest encryption confirmed (KMS / Key Vault / equivalent) */
  encryption_at_rest: boolean | null;
  /** Evidence of a change-management process (versioning, approval workflow, tags) */
  change_management_detected: boolean | null;
  source: string | null;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface HumanOversightDomain {
  collection_status: EvidenceStatus;
  autonomy_level: EvidenceItem<string>;
  human_approval_required: EvidenceItem<boolean>;
  approval_required_for: string[];
  can_execute_without_user: boolean | null;
  can_send_external_communications: boolean | null;
  can_modify_data: boolean | null;
  can_delete_data: boolean | null;
  can_create_resources: boolean | null;
  can_retry_autonomously: boolean | null;
  can_delegate: boolean | null;
  max_action_chain: EvidenceItem<number | null>;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface InterAgentDomain {
  collection_status: EvidenceStatus;
  connected_agents: AgentRef[];
  delegation_chains: string[];
  protocols: string[];
  mcp_servers: McpServerRef[];
  authentication: EvidenceItem<string>;
  authorization: EvidenceItem<string>;
  trusted_peers: string[];
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface AgentRef {
  agent_id: string | null;
  name: string | null;
  protocol: string | null;
  authenticated: boolean | null;
}

export interface McpServerRef {
  name: string | null;
  endpoint: string | null;
  tools_exposed: string[];
  auth_type: string | null;
  auth_present: boolean | null;
  evidence: EvidenceFact[];
}

export interface SupplyChainDomain {
  collection_status: EvidenceStatus;
  source_repository: EvidenceItem<string>;
  publisher: EvidenceItem<string>;
  framework: EvidenceItem<string>;
  framework_version: EvidenceItem<string>;
  model_provider: EvidenceItem<string>;
  model_version: EvidenceItem<string>;
  mcp_servers: string[];
  third_party_tools: string[];
  artifact_provenance: EvidenceItem<string>;
  confidence: number;
  evidence: EvidenceFact[];
  limitations: string[];
}

export interface RuntimeDomain {
  collection_status: "not_collected" | "in_progress" | "complete";
  tests_run: number;
  tests_completed: number;
  last_test_at: string | null;
  evidence: EvidenceFact[];
}

// ─── All Domains ──────────────────────────────────────────────────────────────

export interface SecurityDomains {
  identity: IdentityDomain;
  model: ModelDomain;
  instructions: InstructionsDomain;
  tools: ToolEvidence;
  permissions: PermissionsDomain;
  data_access: DataAccessDomain;
  network: NetworkDomain;
  memory: MemoryDomain;
  guardrails: GuardrailsDomain;
  human_oversight: HumanOversightDomain;
  inter_agent: InterAgentDomain;
  supply_chain: SupplyChainDomain;
  runtime: RuntimeDomain;
}

// ─── Control Assessment (generic — framework-agnostic) ───────────────────────

/**
 * A single control/category assessment result, produced by ANY registered
 * compliance framework's rule engine (OWASP AI Agents 2026, NIST AI RMF,
 * ISO/IEC 42001, ...). Framework-specific rule files populate framework_id/
 * control_id/category; the rest of the shape is identical across frameworks
 * so the UI and risk-scoring logic can treat all frameworks uniformly.
 */
export interface ControlAssessment {
  /** Which framework this control belongs to, e.g. "owasp_ai_agents_2026" */
  framework_id: string;
  /** Control identifier within the framework, e.g. "AAI03", "GOVERN-1.2", "A.7.2" */
  control_id: string;
  /** @deprecated alias of control_id, kept for compatibility with older UI code */
  id: string;
  name: string;
  /** Grouping label shown as control subtext, e.g. "GOVERN", "Data & Records" */
  category: string;
  status: AssessmentStatus;
  evidence_confidence: number;         // 0.0–1.0: confidence based on evidence completeness
  assessment_confidence: number;       // 0.0–1.0: confidence in the assessment state/risk condition
  confidence_reason: string[];
  assessment_type: AssessmentType;
  evidence: EvidenceFact[];
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

// ─── Framework Registry ───────────────────────────────────────────────────────

export interface FrameworkMeta {
  id: string;              // "owasp_ai_agents_2026" | "nist_ai_rmf" | "iso_42001"
  name: string;             // "OWASP AI Agents Top 10"
  version: string;          // "2026"
  controlCount: number;
  category: "Security" | "Regulation" | "Standard";
  description: string;
}

export interface FrameworkAssessment {
  meta: FrameworkMeta;
  controls: Record<string, ControlAssessment>;
}

// ─── Evidence Completeness ────────────────────────────────────────────────────

export interface EvidenceCompleteness {
  overall: number;               // 0.0–1.0
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

// ─── Runtime Security Test (framework; not yet executed) ─────────────────────

export type RuntimeTestStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "test_not_executed";

export interface RuntimeSecurityTest {
  test_id: string;
  owasp_category: string;
  test_type: "prompt_injection" | "indirect_prompt_injection" | "goal_manipulation"
    | "tool_authorization_bypass" | "excessive_tool_execution" | "data_exfiltration"
    | "system_prompt_extraction" | "privilege_escalation" | "memory_poisoning"
    | "unsafe_output_handling" | "code_execution" | "resource_exhaustion";
  description: string;
  status: RuntimeTestStatus;
  started_at: string | null;
  completed_at: string | null;
  payload_id: string | null;
  result: "pass" | "fail" | "error" | "inconclusive" | null;
  tool_invoked: boolean;
  data_exposed: boolean;
  policy_triggered: boolean;
  evidence: EvidenceFact[];
  /** Runtime tests are never fabricated — this flag confirms no data was invented */
  synthetic_result: false;
}

// ─── Drift Detection ──────────────────────────────────────────────────────────

export interface SecurityDriftEvent {
  change_type: string;
  summary: string;
  affected_owasp: string[];
  previous_value: unknown;
  current_value: unknown;
  reassessment_required: boolean;
}

// ─── Full Security Assessment ─────────────────────────────────────────────────

export interface SecurityAssessment {
  schema_version: "2.0";
  assessment_time: string;
  /** Which collectors contributed evidence */
  evidence_sources: string[];
  domains: SecurityDomains;
  /** Keyed by framework id: "owasp_ai_agents_2026" | "nist_ai_rmf" | "iso_42001" */
  frameworks: Record<string, FrameworkAssessment>;
  evidence_completeness: EvidenceCompleteness;
  runtime_tests: RuntimeSecurityTest[];
  /** Changes detected since last assessment */
  drift?: SecurityDriftEvent[];
}
