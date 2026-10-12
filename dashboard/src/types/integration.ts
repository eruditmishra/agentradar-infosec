export type IntegrationProvider =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "gitlab"
  | "jenkins"
  | "crowdstrike"
  | "cortex_xdr"
  | "sentinelone"
  | "intune"
  | "netskope"
  | "salesforce"
  | "claude"
  | "sap"
  | "splunk"
  | "sentinel"
  | "okta"
  | "entra"
  | "epic"
  | "cerner"
  | "jira"
  | "zscaler"
  | "palo_alto"
  | "slack"
  | "teams";
export type IntegrationStatus = "active" | "inactive" | "error";

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

export interface ProviderCatalogItem {
  id: IntegrationProvider;
  name: string;
  cat: string;
  icon: string;
  desc: string;
  color: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'select';
    placeholder?: string;
    required: boolean;
    options?: string[];
  }[];
}
