// ─── Primitive enums ────────────────────────────────────────────────────────

export type ScanProvider =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "gitlab"
  | "jenkins"
  | "github_actions"
  | "gitlab_ci"
  | "crowdstrike"
  | "defender"
  | "intune"
  | "cortex"
  | "cortex_xdr"
  | "netskope"
  | "kubernetes"
  | "k8s"
  | "m365_copilot"
  | "salesforce"
  | "workday"
  | "servicenow"
  | "openai"
  | "claude"
  | "sap";
export type ConnectorStatus = "active" | "inactive" | "error";
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ScanIntegrationStatus = "pending" | "running" | "completed" | "failed";
export type AgentGovernanceStatus = "shadow" | "reviewed" | "approved" | "flagged" | "conditionally_approved" | "conditionally_shadow" | "under_review";
export type ModelValidationStatus =
  | "pending"
  | "approved"
  | "flagged"
  | "deprecated"
  | "under_review";
export type ModelType =
  | "llm"
  | "embedding"
  | "classifier"
  | "image"
  | "multimodal"
  | "unknown";
export type ModelRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "aws"
  | "azure"
  | "meta"
  | "mistral"
  | "cohere"
  | "unknown";
export type UsageContext = "primary" | "embedding" | "fine_tuned" | "fallback";
export type LogLevel = "info" | "warn" | "error";

// ─── Provider-specific config / secrets shapes ───────────────────────────────
// config   = non-secret, stored as plain JSONB
// secrets  = sensitive, encrypted before storage (AES-256-GCM)

export interface AwsConfig {
  region: string;
  accountId: string;
}
export interface AwsSecrets {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface AzureConfig {
  subscriptionId: string;
  clientId: string;
  /** Azure Active Directory tenant ID */
  tenantId: string;
}
export interface AzureSecrets {
  clientSecret: string;
}

export interface GcpConfig {
  projectId: string;
  clientEmail: string;
}
export interface GcpSecrets {
  privateKey: string;
}

export interface GithubConfig {
  orgOrUser?: string;
  apiBase?: string;
}
export interface GithubSecrets {
  token: string;
}

export interface GitlabConfig {
  host?: string;
  projectGroup?: string;
}
export interface GitlabSecrets {
  token: string;
}

export interface JenkinsConfig {
  baseUrl: string;
  username?: string;
}
export interface JenkinsSecrets {
  apiToken?: string;
  password?: string;
}

export interface GithubActionsConfig {
  org?: string;
  owner?: string;
  apiBase?: string;
}
export interface GithubActionsSecrets {
  token?: string;
  apiToken?: string;
}

export interface GitlabCiConfig {
  host?: string;
  group?: string;
  namespace?: string;
}
export interface GitlabCiSecrets {
  token?: string;
  apiToken?: string;
}

export interface CrowdstrikeConfig {
  clientId: string;
  baseUrl?: string;
}
export interface CrowdstrikeSecrets {
  clientSecret: string;
}

export interface DefenderConfig {
  tenantId: string;
  clientId: string;
}
export interface DefenderSecrets {
  clientSecret: string;
}

export interface IntuneConfig {
  tenantId: string;
  clientId: string;
}
export interface IntuneSecrets {
  clientSecret: string;
}

export interface CortexConfig {
  apiKeyId: string;
  fqdn: string;
  region?: string;
}
export interface CortexSecrets {
  apiKey: string;
}

export interface NetskopeConfig {
  tenant: string;
}
export interface NetskopeSecrets {
  apiToken: string;
}

export interface KubernetesConfig {
  apiServer: string;
  skipTlsVerify?: boolean;
}
export interface KubernetesSecrets {
  token: string;
}

export interface M365CopilotConfig {
  tenantId: string;
  clientId: string;
}
export interface M365CopilotSecrets {
  clientSecret: string;
}

export interface SalesforceConfig {
  clientId: string;
  loginUrl?: string;
  username?: string;
}
export interface SalesforceSecrets {
  clientSecret?: string;
  password?: string;
  privateKey?: string;
}

export interface WorkdayConfig {
  tenant: string;
  clientId: string;
  apiBase?: string;
}
export interface WorkdaySecrets {
  clientSecret?: string;
  refreshToken?: string;
}

export interface ServiceNowConfig {
  instance: string;
  username: string;
}
export interface ServiceNowSecrets {
  password?: string;
  clientSecret?: string;
}

export interface OpenAiConfig {
  organizationId?: string;
  apiBase?: string;
}
export interface OpenAiSecrets {
  apiKey?: string;
  token?: string;
}

export interface ClaudeConfig {
  apiBase?: string;
  workspaceId?: string;
}
export interface ClaudeSecrets {
  apiKey: string;
}

export interface SapConfig {
  serviceUrl: string;
  clientId: string;
  authUrl: string;
  resourceGroup?: string;
}
export interface SapSecrets {
  clientSecret: string;
}

/** Discriminated union — narrows config+secrets by provider */
export type ProviderInput =
  | { provider: "aws"; config: AwsConfig; secrets: AwsSecrets }
  | { provider: "azure"; config: AzureConfig; secrets: AzureSecrets }
  | { provider: "gcp"; config: GcpConfig; secrets: GcpSecrets }
  | { provider: "github"; config: GithubConfig; secrets: GithubSecrets }
  | { provider: "gitlab"; config: GitlabConfig; secrets: GitlabSecrets }
  | { provider: "jenkins"; config: JenkinsConfig; secrets: JenkinsSecrets }
  | { provider: "github_actions"; config: GithubActionsConfig; secrets: GithubActionsSecrets }
  | { provider: "gitlab_ci"; config: GitlabCiConfig; secrets: GitlabCiSecrets }
  | { provider: "crowdstrike"; config: CrowdstrikeConfig; secrets: CrowdstrikeSecrets }
  | { provider: "defender"; config: DefenderConfig; secrets: DefenderSecrets }
  | { provider: "intune"; config: IntuneConfig; secrets: IntuneSecrets }
  | { provider: "cortex" | "cortex_xdr"; config: CortexConfig; secrets: CortexSecrets }
  | { provider: "netskope"; config: NetskopeConfig; secrets: NetskopeSecrets }
  | { provider: "kubernetes" | "k8s"; config: KubernetesConfig; secrets: KubernetesSecrets }
  | { provider: "m365_copilot"; config: M365CopilotConfig; secrets: M365CopilotSecrets }
  | { provider: "salesforce"; config: SalesforceConfig; secrets: SalesforceSecrets }
  | { provider: "workday"; config: WorkdayConfig; secrets: WorkdaySecrets }
  | { provider: "servicenow"; config: ServiceNowConfig; secrets: ServiceNowSecrets }
  | { provider: "openai"; config: OpenAiConfig; secrets: OpenAiSecrets }
  | { provider: "claude"; config: ClaudeConfig; secrets: ClaudeSecrets }
  | { provider: "sap"; config: SapConfig; secrets: SapSecrets };

// ─── cloud_connectors ────────────────────────────────────────────────────────

/** DB row — secrets_encrypted is NEVER sent to the client */
export interface CloudConnector {
  id: string;
  tenant_id: string | null;
  name: string;
  provider: ScanProvider;
  environment: string;
  config: Record<string, unknown>;
  status: ConnectorStatus;
  last_tested_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Internal row that includes the encrypted field (repo-layer only) */
export interface CloudConnectorWithSecrets extends CloudConnector {
  secrets_encrypted: string;
}

export interface CreateConnectorInput {
  name: string;
  provider: ScanProvider;
  environment?: string;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
}

export interface UpdateConnectorInput {
  name?: string;
  environment?: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}

// ─── discovery_scans ─────────────────────────────────────────────────────────

export interface DiscoveryScan {
  id: string;
  tenant_id: string | null;
  integration_ids: string[];
  scan_all: boolean;
  status: ScanStatus;
  triggered_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  stats: ScanStats | null;
  created_at: Date;
}

export interface ScanStats {
  totalAgents: number;
  totalModels: number;
  byIntegration: Record<
    string,
    { found: number; models: number; errors: number }
  >;
  discoveryErrors?: unknown[];
}

export interface StartScanInput {
  integration_ids?: string[];
  scan_all?: boolean;
}

// ─── scan_integrations ─────────────────────────────────────────────────────────

export interface ScanIntegrationRow {
  id: string;
  scan_id: string;
  integration_id: string;
  provider: string;
  integration_name: string | null;
  status: ScanIntegrationStatus;
  agents_found: number;
  models_found: number;
  errors: unknown[];
  started_at: Date | null;
  completed_at: Date | null;
}

// ─── discovered_agents ───────────────────────────────────────────────────────

export interface DiscoveredAgent {
  id: string;
  tenant_id: string | null;
  scan_id: string | null;
  integration_id: string | null;
  fingerprint: string;
  name: string | null;
  owner: string | null;
  device: string | null;
  hostname: string | null;
  ip: string | null;
  operating_system: string | null;
  department: string | null;
  business_unit: string | null;
  location: string | null;
  repository: string | null;
  framework: string | null;
  programming_language: string | null;
  model: string | null;
  provider: string | null;
  version: string | null;
  deployment_type: string | null;
  cloud_provider: string | null;
  region: string | null;
  container: string | null;
  vm: string | null;
  endpoint: string | null;
  ide: string | null;
  running_status: string | null;
  memory_usage_mb: number | null;
  cpu_usage_pct: number | null;
  execution_capability: string | null;
  creation_time: Date | null;
  last_modified: Date | null;
  last_seen: Date | null;
  first_discovered: Date | null;
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
  mcp_connections: unknown[];
  tools: unknown[];
  prompt_templates: unknown[];
  connected_applications: unknown[];
  permissions: unknown[];
  risk_indicators: string[];
  source_collectors: string[];
  memory_store: string | null;
  vector_database: string | null;
  identity_used: string | null;
  how_identified: string | null;
  evidence_class: string | null;
  evidence_reason: string | null;
  agent_status: string | null;
  status: AgentGovernanceStatus;
  category: string | null;
  confidence_score: number | null;
  risk_score?: number | null;
  riskScoreBreakdown?: any;
  metadata: Record<string, unknown> | null;
  agent_config: Record<string, unknown> | null;
  agent_access: Record<string, unknown> | null;
  ownership: Record<string, unknown> | null;
  data_access_classification: Record<string, unknown> | null;
  mesh: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;

  requested_status?: AgentGovernanceStatus | null;
  previous_status?: AgentGovernanceStatus | null;
  request_remark?: string | null;
  approval_remark?: string | null;
}

export interface UpdateAgentInput {
  status?: AgentGovernanceStatus;
  requested_status?: AgentGovernanceStatus | null;
  previous_status?: AgentGovernanceStatus | null;
  request_remark?: string | null;
  approval_remark?: string | null;
}

/**
 * The raw shape emitted by each scanner's observe/discover function.
 * Fields map 1-to-1 with the scanner JSON the user provided.
 * All fields are optional except fingerprint.
 */
export interface ScannerRawObservation {
  // Scanner meta
  collector_id?: string;
  fingerprint: string;

  // Identity scalars
  name?: string | null;
  owner?: string | null;
  device?: string | null;
  hostname?: string | null;
  ip?: string | null;
  operating_system?: string | null;
  department?: string | null;
  business_unit?: string | null;
  location?: string | null;
  repository?: string | null;

  // Agent identity
  framework?: string | null;
  programming_language?: string | null;
  model?: string | null;
  provider?: string | null;
  version?: string | null;
  deployment_type?: string | null;
  cloud_provider?: string | null;
  region?: string | null;
  container?: string | null;
  vm?: string | null;
  endpoint?: string | null;
  ide?: string | null;

  // Runtime
  running_status?: string | null;
  memory_usage_mb?: number | null;
  cpu_usage_pct?: number | null;
  execution_capability?: string | null;
  creation_time?: string | null;
  last_modified?: string | null;
  last_seen?: string | null;
  first_discovered?: string | null;

  // Security flags
  api_keys_detected?: boolean;
  secrets_detected?: boolean;
  internet_access?: boolean;
  filesystem_access?: boolean;
  database_access?: boolean;
  github_access?: boolean;
  slack_access?: boolean;
  email_access?: boolean;
  calendar_access?: boolean;
  browser_access?: boolean;

  // Arrays
  mcp_connections?: unknown[];
  tools?: unknown[];
  prompt_templates?: unknown[];
  memory_store?: string | null;
  vector_database?: string | null;
  connected_applications?: unknown[];
  identity_used?: string | null;
  permissions?: unknown[];
  risk_indicators?: string[];
  source_collectors?: string[];

  // Scalar flags
  confidence_score?: string | number | null;
  category?: string | null;

  // JSONB blobs (top-level from scanner JSON)
  metadata?: Record<string, unknown>;
  agentConfig?: Record<string, unknown>;
  agentAccess?: Record<string, unknown>;
  ownership?: Record<string, unknown>;
  dataAccessClassification?: Record<string, unknown>;
  mesh?: Record<string, unknown>;

  // Scanner classification fields (top-level)
  howIdentified?: string | null;
  evidenceClass?: string | null;
  agentStatus?: string | null;
  evidenceReason?: string | null;

  // Scanner internal blocks (may exist in raw scanner output)
  agent?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  relationships?: unknown[];
}

// ─── discovered_models ───────────────────────────────────────────────────────

export interface DiscoveredModel {
  id: string;
  tenant_id: string | null;
  name: string;
  display_name: string | null;
  provider: string | null;
  model_type: ModelType;
  version: string | null;
  family: string | null;
  validation_status: ModelValidationStatus;
  risk_level: ModelRiskLevel;
  agent_count: number;
  first_seen_at: Date;
  last_seen_at: Date;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  requested_status: string | null;
  previous_status: string | null;
}

export interface UpdateModelInput {
  display_name?: string;
  validation_status?: ModelValidationStatus;
  risk_level?: ModelRiskLevel;
  model_type?: ModelType;
  notes?: string;
  requested_status?: string | null;
  previous_status?: string | null;
}

// ─── agent_model_usage ───────────────────────────────────────────────────────

export interface AgentModelUsage {
  id: string;
  agent_id: string;
  model_id: string;
  usage_context: UsageContext;
  first_seen_at: Date;
  last_seen_at: Date;
}

// ─── scan_logs ───────────────────────────────────────────────────────────────

export interface ScanLog {
  id: string;
  scan_id: string;
  integration_id: string | null;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateScanLogInput {
  level: LogLevel;
  message: string;
  integration_id?: string;
  metadata?: Record<string, unknown>;
}
