import type { ProviderCatalogItem } from "../../../types/integration";

export const INTEGRATION_PROVIDERS: ProviderCatalogItem[] = [
  // ── Cloud Providers ──────────────────────────────────────────────────────────
  {
    id: 'azure', name: 'Microsoft Azure', cat: 'Cloud Provider', icon: 'azure',
    desc: 'Discover AI workloads across Azure Cognitive Services, OpenAI, and ML Studio',
    color: '#0078d4',
    fields: [
      { key: 'tenantId',      label: 'Tenant ID',       type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientId',      label: 'App (Client) ID', type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientSecret',  label: 'Client Secret',   type: 'password', placeholder: 'Enter client secret value',           required: true },
      { key: 'subscriptionId',label: 'Subscription ID', type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
    ],
  },
  {
    id: 'aws', name: 'Amazon AWS', cat: 'Cloud Provider', icon: 'aws',
    desc: 'Discover AI agents running on SageMaker, Bedrock, Lambda, and ECS',
    color: '#ff9900',
    fields: [
      { key: 'accountId',       label: 'Account ID',        type: 'text',     placeholder: '12-digit AWS Account ID', required: true },
      { key: 'accessKeyId',     label: 'Access Key ID',     type: 'text',     placeholder: 'AKIAIOSFODNN7EXAMPLE', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter secret access key', required: true },
      { key: 'region',          label: 'Default Region',    type: 'text',     placeholder: 'us-east-1',              required: true },
      { key: 'sessionToken',    label: 'Session Token',     type: 'password', placeholder: 'Enter session token (optional)', required: false },
    ],
  },
  {
    id: 'gcp', name: 'Google Cloud', cat: 'Cloud Provider', icon: 'gcp',
    desc: 'Discover AI models on Vertex AI, Cloud AI APIs, and Gemini deployments',
    color: '#34a853',
    fields: [
      { key: 'projectId',         label: 'Project ID',                 type: 'text',     placeholder: 'my-gcp-project-id',   required: true },
      { key: 'clientEmail',       label: 'Client Email',               type: 'text',     placeholder: 'service-account@project.iam.gserviceaccount.com', required: true },
      { key: 'privateKey',        label: 'Private Key',                type: 'textarea', placeholder: '-----BEGIN PRIVATE KEY-----\\n...', required: true },
    ],
  },
  // ── Security & Endpoint ──────────────────────────────────────────────────────
  {
    id: 'crowdstrike', name: 'CrowdStrike Falcon', cat: 'Endpoint', icon: 'crowdstrike',
    desc: 'Detect AI agents running on managed endpoints via CrowdStrike RTR and XDR',
    color: '#e0161e',
    fields: [
      { key: 'clientId',     label: 'OAuth2 Client ID',     type: 'text',     placeholder: 'CrowdStrike API client ID',     required: true },
      { key: 'clientSecret', label: 'OAuth2 Client Secret', type: 'password', placeholder: 'Enter client secret',           required: true },
      { key: 'baseUrl',      label: 'API Base URL',         type: 'text',     placeholder: 'https://api.crowdstrike.com',   required: false },
    ],
  },
  {
    id: 'cortex_xdr', name: 'Palo Alto Cortex XDR', cat: 'Endpoint', icon: 'cortex_xdr',
    desc: 'Detect AI processes across endpoints monitored by Cortex XDR',
    color: '#fa582d',
    fields: [
      { key: 'apiKeyId',  label: 'API Key ID',       type: 'text',     placeholder: 'Enter API key ID',               required: true },
      { key: 'apiKey',    label: 'API Key',          type: 'password', placeholder: 'Enter API key',                  required: true },
      { key: 'fqdn',      label: 'Tenant FQDN',      type: 'text',     placeholder: 'api-tenant.xdr.us.paloaltonetworks.com', required: true },
      { key: 'apiKeyType',label: 'API Key Type',     type: 'select',   options: ['Advanced', 'Standard'],             required: false },
    ],
  },
  {
    id: 'sentinelone', name: 'SentinelOne', cat: 'Endpoint', icon: 'sentinelone',
    desc: 'Scan managed endpoints for AI processes via SentinelOne Deep Visibility',
    color: '#6f2de4',
    fields: [
      { key: 'apiToken',  label: 'API Token',     type: 'password', placeholder: 'Enter SentinelOne API token', required: true },
      { key: 'baseUrl',   label: 'Console URL',   type: 'text',     placeholder: 'https://tenant.sentinelone.net', required: true },
    ],
  },
  {
    id: 'intune', name: 'Microsoft Intune', cat: 'Endpoint', icon: 'intune',
    desc: 'Detect AI apps installed on Intune-managed devices via Microsoft Graph',
    color: '#0078d4',
    fields: [
      { key: 'tenantId',     label: 'Tenant ID',      type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientId',     label: 'App (Client) ID',type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientSecret', label: 'Client Secret',  type: 'password', placeholder: 'Enter client secret value',           required: true },
    ],
  },
  {
    id: 'netskope', name: 'Netskope', cat: 'Endpoint', icon: 'netskope',
    desc: 'Discover AI apps, shadow AI web traffic, and client inventory via Netskope Security Cloud',
    color: '#0088cc',
    fields: [
      { key: 'tenant',   label: 'Tenant Name or FQDN',       type: 'text',     placeholder: 'acme or acme.goskope.com', required: true },
      { key: 'apiToken', label: 'REST API v1 / v2 Token',    type: 'password', placeholder: 'Enter Netskope API token', required: true },
    ],
  },
  // ── SIEM ─────────────────────────────────────────────────────────────────────
  {
    id: 'splunk', name: 'Splunk', cat: 'SIEM', icon: 'splunk',
    desc: 'Send AI agent alerts to Splunk via HTTP Event Collector (HEC)',
    color: '#65a637',
    fields: [
      { key: 'url',      label: 'Splunk HEC URL', type: 'text',     placeholder: 'https://splunk.company.com:8088', required: true },
      { key: 'token',    label: 'HEC Token',      type: 'password', placeholder: 'Enter HEC token',                required: true },
      { key: 'index',    label: 'Index',           type: 'text',     placeholder: 'main',                           required: false },
    ],
  },
  {
    id: 'sentinel', name: 'Microsoft Sentinel', cat: 'SIEM', icon: 'sentinel',
    desc: 'Stream AI agent risk events to Microsoft Sentinel via DCR / Log Analytics',
    color: '#0078d4',
    fields: [
      { key: 'workspaceId',  label: 'Workspace ID',       type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'primaryKey',   label: 'Primary Key',        type: 'password', placeholder: 'Enter workspace primary key',          required: true },
      { key: 'logType',      label: 'Custom Log Type',    type: 'text',     placeholder: 'AgentRadar_Alerts',                    required: false },
    ],
  },
  // ── Identity ─────────────────────────────────────────────────────────────────
  {
    id: 'okta', name: 'Okta', cat: 'Identity', icon: 'okta',
    desc: 'Correlate AI agent access patterns with Okta identity and SSO logs',
    color: '#007dc1',
    fields: [
      { key: 'domain',   label: 'Okta Domain',  type: 'text',     placeholder: 'https://yourorg.okta.com',  required: true },
      { key: 'apiToken', label: 'API Token',     type: 'password', placeholder: 'Enter Okta API token',     required: true },
    ],
  },
  {
    id: 'entra', name: 'Microsoft Entra ID', cat: 'Identity', icon: 'entra',
    desc: 'Correlate AI agent activities with Entra ID sign-in logs and service principals',
    color: '#0078d4',
    fields: [
      { key: 'tenantId',     label: 'Tenant ID',      type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientId',     label: 'App (Client) ID',type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'clientSecret', label: 'Client Secret',  type: 'password', placeholder: 'Enter client secret value',           required: true },
    ],
  },
  // ── Healthcare ────────────────────────────────────────────────────────────────
  {
    id: 'epic', name: 'Epic EHR', cat: 'Healthcare', icon: 'epic',
    desc: 'Scan FHIR API traffic from Epic for unauthorized AI data access',
    color: '#e31b23',
    fields: [
      { key: 'baseUrl',       label: 'FHIR Base URL', type: 'text',     placeholder: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4', required: true },
      { key: 'clientId',      label: 'Client ID',     type: 'text',     placeholder: 'Epic App Client ID',  required: true },
      { key: 'privateKey',    label: 'Private Key (PEM)', type: 'textarea', placeholder: '-----BEGIN RSA PRIVATE KEY-----', required: true },
    ],
  },
  {
    id: 'cerner', name: 'Oracle Cerner', cat: 'Healthcare', icon: 'cerner',
    desc: 'Monitor FHIR API access and AI data flows in Cerner Millennium',
    color: '#e63012',
    fields: [
      { key: 'fhirUrl',   label: 'FHIR Base URL',       type: 'text',     placeholder: 'https://fhir-ehr.cerner.com/r4', required: true },
      { key: 'accountId', label: 'Cerner Account ID',   type: 'text',     placeholder: 'Enter account ID',               required: true },
      { key: 'secret',    label: 'Client Secret',        type: 'password', placeholder: 'Enter client secret',            required: true },
    ],
  },
  // ── Developer Tools ───────────────────────────────────────────────────────────
  {
    id: 'github', name: 'GitHub', cat: 'VCS / Dev Tools', icon: 'github',
    desc: 'Scan GitHub repos and Actions for AI agents, secret leaks, and LLM dependencies',
    color: '#24292e',
    fields: [
      { key: 'token',   label: 'Personal Access Token (PAT)', type: 'password', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'orgOrUser', label: 'Organization (optional)',     type: 'text',     placeholder: 'my-org-name',              required: false },
      { key: 'apiBase', label: 'API Base URL (optional)', type: 'text', placeholder: 'https://api.github.com', required: false },
    ],
  },
  {
    id: 'gitlab', name: 'GitLab', cat: 'VCS / Dev Tools', icon: 'gitlab',
    desc: 'Scan GitLab projects and CI/CD pipelines for AI agents and dependencies',
    color: '#e24329',
    fields: [
      { key: 'token',        label: 'Access Token',        type: 'password', placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'host',         label: 'Host (optional)',     type: 'text',     placeholder: 'https://gitlab.com',       required: false },
      { key: 'projectGroup', label: 'Group ID (optional)', type: 'text',     placeholder: '123456',                   required: false },
    ],
  },
  {
    id: 'jira', name: 'Jira', cat: 'VCS / Dev Tools', icon: 'jira',
    desc: 'Create Jira tickets automatically for agent violations and policy breaches',
    color: '#0052cc',
    fields: [
      { key: 'baseUrl',  label: 'Jira Base URL',  type: 'text',     placeholder: 'https://yourorg.atlassian.net', required: true },
      { key: 'email',    label: 'User Email',     type: 'text',     placeholder: 'admin@company.com',             required: true },
      { key: 'apiToken', label: 'API Token',      type: 'password', placeholder: 'Enter Atlassian API token',    required: true },
      { key: 'project',  label: 'Project Key',    type: 'text',     placeholder: 'SEC',                          required: false },
    ],
  },
  {
    id: 'jenkins', name: 'Jenkins CI/CD', cat: 'VCS / Dev Tools', icon: 'jenkins',
    desc: 'Scan Jenkins build jobs, pipelines, and workspace configs for AI frameworks and credentials',
    color: '#d33833',
    fields: [
      { key: 'baseUrl',  label: 'Jenkins Server URL',      type: 'text',     placeholder: 'https://jenkins.company.com:8080', required: true },
      { key: 'username', label: 'API Username (optional)', type: 'text',     placeholder: 'admin or svc_agentradar',          required: false },
      { key: 'apiToken', label: 'API Token / Password',    type: 'password', placeholder: 'Enter Jenkins user API token',     required: true },
    ],
  },
  // ── SaaS & AI Platforms ───────────────────────────────────────────────────────
  {
    id: 'salesforce', name: 'Salesforce Agentforce', cat: 'SaaS Platform', icon: 'salesforce',
    desc: 'Discover Salesforce Agentforce autonomous agents, custom bots, and Einstein AI platform capabilities',
    color: '#00a1e0',
    fields: [
      { key: 'loginUrl',     label: 'Login / My Domain URL',                  type: 'text',     placeholder: 'https://login.salesforce.com or https://yourorg.my.salesforce.com', required: false },
      { key: 'clientId',     label: 'Connected App Consumer Key (Client ID)', type: 'text',     placeholder: '3MVG9...', required: true },
      { key: 'clientSecret', label: 'Connected App Consumer Secret',          type: 'password', placeholder: 'Enter Consumer Secret', required: true },
      { key: 'username',     label: 'Integration User Email (optional)',      type: 'text',     placeholder: 'agentradar.svc@company.com', required: false },
    ],
  },
  {
    id: 'claude', name: 'Anthropic Claude', cat: 'AI Platform', icon: 'claude',
    desc: 'Monitor Anthropic Claude workspace deployments, API keys, and model usage',
    color: '#cc785c',
    fields: [
      { key: 'apiKey',      label: 'Anthropic Admin / API Key',    type: 'password', placeholder: 'sk-ant-api03-...', required: true },
      { key: 'apiBase',     label: 'API Base URL (optional)',      type: 'text',     placeholder: 'https://api.anthropic.com', required: false },
      { key: 'workspaceId', label: 'Workspace / Org ID (optional)',type: 'text',     placeholder: 'org_xxxxxxxxxxxxxxxx', required: false },
    ],
  },
  {
    id: 'sap', name: 'SAP AI Core & BTP', cat: 'SaaS Platform', icon: 'sap',
    desc: 'Scan SAP AI Core and Business Technology Platform for deployed AI models, scenarios, and generative AI hub',
    color: '#008fd3',
    fields: [
      { key: 'serviceUrl',    label: 'SAP AI Core Base URL',        type: 'text',     placeholder: 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com', required: true },
      { key: 'clientId',      label: 'OAuth Client ID',             type: 'text',     placeholder: 'sb-clone-... from service key', required: true },
      { key: 'clientSecret',  label: 'OAuth Client Secret',         type: 'password', placeholder: 'Enter client secret from service key', required: true },
      { key: 'authUrl',       label: 'UAA Token Authentication URL',type: 'text',     placeholder: 'https://subaccount.authentication.eu10.hana.ondemand.com/oauth/token', required: true },
      { key: 'resourceGroup', label: 'Resource Group (optional)',   type: 'text',     placeholder: 'default', required: false },
    ],
  },
  // ── Network ───────────────────────────────────────────────────────────────────
  {
    id: 'zscaler', name: 'Zscaler', cat: 'Network / Proxy', icon: 'zscaler',
    desc: 'Ingest Zscaler proxy logs to detect AI service usage across your network',
    color: '#005EB8',
    fields: [
      { key: 'apiKey',    label: 'API Key',        type: 'password', placeholder: 'Enter Zscaler API key',          required: true },
      { key: 'cloudName', label: 'Cloud Name',     type: 'text',     placeholder: 'zsapi.zscalerone.net',           required: true },
    ],
  },
  {
    id: 'palo_alto', name: 'Palo Alto Firewall', cat: 'Network / Proxy', icon: 'palo_alto',
    desc: 'Monitor AI API traffic via Palo Alto Next-Gen Firewall logs and App-ID',
    color: '#fa582d',
    fields: [
      { key: 'host',   label: 'Firewall Host/IP',  type: 'text',     placeholder: '192.168.1.1 or firewall.corp.com', required: true },
      { key: 'apiKey', label: 'API Key',            type: 'password', placeholder: 'Enter Palo Alto API key',         required: true },
      { key: 'vsys',   label: 'Virtual System',     type: 'text',     placeholder: 'vsys1',                          required: false },
    ],
  },
  // ── Communication ─────────────────────────────────────────────────────────────
  {
    id: 'slack', name: 'Slack', cat: 'Communication', icon: 'slack',
    desc: 'Send real-time AI agent alerts and policy violation notifications to Slack',
    color: '#4a154b',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/T.../B.../xxx', required: true },
      { key: 'channel',    label: 'Channel (optional)',   type: 'text', placeholder: '#ai-security',                                    required: false },
    ],
  },
  {
    id: 'teams', name: 'Microsoft Teams', cat: 'Communication', icon: 'teams',
    desc: 'Post AI risk alerts and governance summaries to Microsoft Teams channels',
    color: '#6264a7',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text', placeholder: 'https://outlook.office.com/webhook/...', required: true },
    ],
  },
];
