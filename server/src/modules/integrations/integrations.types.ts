export type IntegrationProvider =
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
export type IntegrationStatus = "active" | "inactive" | "error";

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

export interface IntegrationConnection {
  id: string;
  tenant_id: string | null;
  name: string;
  provider: IntegrationProvider;
  environment: string;
  config: Record<string, unknown>;
  secrets_encrypted: string;
  status: IntegrationStatus;
  last_tested_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Client-safe view of an integration (no secrets) */
export interface IntegrationConnectionView {
  id: string;
  name: string;
  provider: IntegrationProvider;
  environment: string;
  config: Record<string, unknown>;
  status: IntegrationStatus;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Used when passing the decrypted integration to scanners */
export interface DecryptedIntegration {
  id: string;
  name: string;
  provider: IntegrationProvider;
  environment: string;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
}
