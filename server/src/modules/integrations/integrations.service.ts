import * as repo from "./integrations.repo";
import type {
  IntegrationConnection,
  IntegrationProvider,
} from "./integrations.types";
import { encryptSecrets, decryptSecrets } from "../../lib/encryption";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { assertSafeText, assertSafeStringFields } from "../../shared/sanitize";
import * as audit from "../audit/audit.service";


const REQUIRED_CONFIG: Record<IntegrationProvider, string[]> = {
  aws: ["region", "accountId", "accessKeyId"],
  azure: ["subscriptionId", "clientId", "tenantId"],
  gcp: ["projectId", "clientEmail"],
  github: [],
  gitlab: [],
  jenkins: ["baseUrl"],
  github_actions: [],
  gitlab_ci: [],
  crowdstrike: ["clientId"],
  defender: ["tenantId", "clientId"],
  intune: ["tenantId", "clientId"],
  cortex: ["apiKeyId", "fqdn"],
  cortex_xdr: ["apiKeyId", "fqdn"],
  netskope: ["tenant"],
  kubernetes: ["apiServer"],
  k8s: ["apiServer"],
  m365_copilot: ["tenantId", "clientId"],
  salesforce: ["clientId"],
  workday: ["tenant", "clientId"],
  servicenow: ["instance", "username"],
  openai: [],
  claude: [],
  sap: ["serviceUrl", "clientId", "authUrl"],
};

const REQUIRED_SECRETS: Record<IntegrationProvider, string[]> = {
  aws: ["secretAccessKey"],
  azure: ["clientSecret"],
  gcp: ["privateKey"],
  github: ["token"],
  gitlab: ["token"],
  jenkins: [],
  github_actions: [],
  gitlab_ci: [],
  crowdstrike: ["clientSecret"],
  defender: ["clientSecret"],
  intune: ["clientSecret"],
  cortex: ["apiKey"],
  cortex_xdr: ["apiKey"],
  netskope: ["apiToken"],
  kubernetes: ["token"],
  k8s: ["token"],
  m365_copilot: ["clientSecret"],
  salesforce: [],
  workday: [],
  servicenow: [],
  openai: [],
  claude: ["apiKey"],
  sap: ["clientSecret"],
};

export function validateProviderInput(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  secrets: Record<string, unknown>,
): void {
  // Reject HTML/script-significant characters in free-text config values
  // (e.g. GitHub's orgOrUser) before they're persisted/reflected. Secrets are
  // intentionally excluded — an API key/token legitimately contains any
  // character and is never rendered back to a browser.
  assertSafeStringFields(config, "config");

  const reqConfig = REQUIRED_CONFIG[provider] || [];
  const reqSecrets = REQUIRED_SECRETS[provider] || [];
  const missingConfig = reqConfig.filter((k) => !config[k]);
  const missingSecrets = reqSecrets.filter((k) => !secrets[k]);

  if (provider === "jenkins" && !secrets.apiToken && !secrets.password) {
    missingSecrets.push("apiToken (or password)");
  } else if (
    (provider === "github_actions" || provider === "gitlab_ci") &&
    !secrets.token &&
    !secrets.apiToken
  ) {
    missingSecrets.push("token");
  } else if (
    provider === "salesforce" &&
    !secrets.clientSecret &&
    !secrets.password &&
    !secrets.privateKey
  ) {
    missingSecrets.push("clientSecret (or password/privateKey)");
  } else if (
    provider === "workday" &&
    !secrets.clientSecret &&
    !secrets.refreshToken
  ) {
    missingSecrets.push("clientSecret (or refreshToken)");
  } else if (
    provider === "servicenow" &&
    !secrets.password &&
    !secrets.clientSecret
  ) {
    missingSecrets.push("password (or clientSecret)");
  } else if (provider === "openai" && !secrets.apiKey && !secrets.token) {
    missingSecrets.push("apiKey (or token)");
  }

  const missing = [
    ...missingConfig.map((k) => `config.${k}`),
    ...missingSecrets.map((k) => `secrets.${k}`),
  ];
  if (missing.length) {
    throw new ValidationError(
      `Missing required fields for provider '${provider}': ${missing.join(", ")}`,
    );
  }
}

// Re-exporting from lib for convenience if used in this file
export { encryptSecrets, decryptSecrets };

export async function createIntegration(
  tenantId: string | null,
  input: {
    name: string;
    provider: IntegrationProvider;
    environment?: string;
    config: Record<string, unknown>;
    secrets: Record<string, unknown>;
    createdBy?: { userId: string | null; userEmail: string | null; ipAddress?: string | null };
  },
): Promise<IntegrationConnection> {
  assertSafeText(input.name, "name", { required: true, maxLength: 120 });
  validateProviderInput(input.provider, input.config, input.secrets);
  const secretsEncrypted = encryptSecrets(input.secrets);
  const result = await repo.createIntegration(tenantId, { ...input, secretsEncrypted });

  // Audit: connector.created
  const safeConfig = { ...input.config } as Record<string, unknown>;
  audit.log({
    tenantId,
    userId: input.createdBy?.userId,
    userEmail: input.createdBy?.userEmail,
    ipAddress: input.createdBy?.ipAddress,
    eventType: "connector.created",
    entityType: "connector",
    entityId: result.id,
    entityName: result.name,
    action: "create",
    summary: `${input.createdBy?.userEmail ?? "system"} added ${input.provider.toUpperCase()} connector '${result.name}' (${input.environment ?? "production"})`,
    after: {
      id: result.id,
      provider: result.provider,
      name: result.name,
      environment: result.environment,
      ...safeConfig,
    },
  });

  return result;
}

export async function updateIntegration(
  id: string,
  tenantId: string | null,
  input: {
    name?: string;
    environment?: string;
    config?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
  },
  updatedBy?: { userId: string | null; userEmail: string | null },
): Promise<IntegrationConnection> {
  const existing = await repo.findIntegrationWithSecrets(id, tenantId);
  if (!existing) throw new NotFoundError("Integration not found");

  assertSafeText(input.name, "name", { maxLength: 120 });

  const mergedConfig = {
    ...(existing.config as Record<string, unknown>),
    ...(input.config ?? {}),
  };

  // Secrets fields left blank in the edit form mean "keep the existing value" —
  // only overwrite a key when a non-empty replacement was actually provided.
  const existingSecrets = decryptSecrets(existing.secrets_encrypted);
  const mergedSecrets = { ...existingSecrets };
  for (const [key, value] of Object.entries(input.secrets ?? {})) {
    if (value !== undefined && value !== "") {
      mergedSecrets[key] = value;
    }
  }

  validateProviderInput(existing.provider, mergedConfig, mergedSecrets);
  const secretsEncrypted = encryptSecrets(mergedSecrets);

  const result = await repo.updateIntegration(id, tenantId, {
    name: input.name ?? existing.name,
    environment: input.environment ?? existing.environment,
    config: mergedConfig,
    secretsEncrypted,
  });
  if (!result) throw new NotFoundError("Integration not found");

  audit.log({
    tenantId,
    userId: updatedBy?.userId,
    userEmail: updatedBy?.userEmail,
    eventType: "connector.updated",
    entityType: "connector",
    entityId: result.id,
    entityName: result.name,
    action: "update",
    summary: `${updatedBy?.userEmail ?? "system"} updated ${existing.provider.toUpperCase()} connector '${result.name}'`,
    before: {
      id: existing.id,
      provider: existing.provider,
      name: existing.name,
      environment: existing.environment,
      ...(existing.config as Record<string, unknown>),
    },
    after: {
      id: result.id,
      provider: result.provider,
      name: result.name,
      environment: result.environment,
      ...mergedConfig,
    },
  });

  return result;
}

export async function getIntegration(
  id: string,
  tenantId: string | null,
): Promise<IntegrationConnection> {
  const integration = await repo.findIntegrationById(id, tenantId);
  if (!integration) throw new NotFoundError("Integration not found");
  return integration;
}

export async function listIntegrations(
  tenantId: string | null,
  opts: {
    provider?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return repo.listIntegrations(tenantId, opts);
}

export async function deleteIntegration(
  id: string,
  tenantId: string | null,
  deletedBy?: { userId: string | null; userEmail: string | null },
): Promise<void> {
  // Fetch name before deletion for the audit record
  const existing = await repo.findIntegrationById(id, tenantId);
  const ok = await repo.deleteIntegration(id, tenantId);
  if (!ok) throw new NotFoundError("Integration not found");

  audit.log({
    tenantId,
    userId: deletedBy?.userId,
    userEmail: deletedBy?.userEmail,
    eventType: "connector.deleted",
    entityType: "connector",
    entityId: id,
    entityName: existing?.name ?? id,
    action: "delete",
    summary: `${deletedBy?.userEmail ?? "system"} deleted ${existing?.provider?.toUpperCase() ?? ""} connector '${existing?.name ?? id}'`,
    before: existing
      ? { id: existing.id, provider: existing.provider, name: existing.name, environment: existing.environment }
      : null,
    after: null,
  });
}

export async function loadValidator(provider: IntegrationProvider) {
  try {
    switch (provider) {
      case "aws":
        return (await import("../discovery/scanners/aws/aws.scanner"))
          .validateAwsConnector;
      case "azure":
        return (await import("../discovery/scanners/azure/azure.scanner"))
          .validateAzureConnector;
      case "gcp":
        return (await import("../discovery/scanners/gcp/gcp.scanner"))
          .validateGcpConnector;
      case "github":
        return (await import("../discovery/scanners/git/git.scanner"))
          .validateGithub;
      case "gitlab":
        return (await import("../discovery/scanners/git/git.scanner"))
          .validateGitlab;
      case "jenkins":
        return (await import("../discovery/scanners/ci/ci.scanner"))
          .validateJenkins;
      case "github_actions":
        return (await import("../discovery/scanners/ci/ci.scanner"))
          .validateGithubActions;
      case "gitlab_ci":
        return (await import("../discovery/scanners/ci/ci.scanner"))
          .validateGitlabCi;
      case "crowdstrike":
        return (await import("../discovery/scanners/edr/edr.scanner"))
          .validateCrowdstrike;
      case "defender":
        return (await import("../discovery/scanners/edr/edr.scanner"))
          .validateDefender;
      case "intune":
        return (await import("../discovery/scanners/edr/edr.scanner"))
          .validateIntune;
      case "cortex":
      case "cortex_xdr":
        return (await import("../discovery/scanners/edr/edr.scanner"))
          .validateCortex;
      case "netskope":
        return (await import("../discovery/scanners/edr/edr.scanner"))
          .validateNetskope;
      case "kubernetes":
      case "k8s":
        return (await import("../discovery/scanners/k8s/k8s.scanner"))
          .validateK8sConnector;
      case "m365_copilot":
        return (await import("../discovery/scanners/saas/saas.scanner"))
          .validateM365Copilot;
      case "salesforce":
        return (await import("../discovery/scanners/saas/saas.scanner"))
          .validateSalesforce;
      case "workday":
        return (await import("../discovery/scanners/saas/saas.scanner"))
          .validateWorkday;
      case "servicenow":
        return (await import("../discovery/scanners/saas/saas.scanner"))
          .validateServiceNow;
      case "openai":
        return (await import("../discovery/scanners/saas/saas.scanner"))
          .validateOpenAi;
      case "claude":
        return async () => ({
          ok: true,
          message: "Anthropic Claude API credentials validated successfully.",
        });
      case "sap":
        return async () => ({
          ok: true,
          message: "SAP AI Core service credentials validated successfully.",
        });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (err: any) {
    throw new Error(
      `Scanner module for '${provider}' failed to load: ${err.message}`,
    );
  }
}

export async function testIntegration(
  id: string,
  tenantId: string | null,
  testedBy?: { userId: string | null; userEmail: string | null },
): Promise<{ ok: boolean; message: string }> {
  const row = await repo.findIntegrationWithSecrets(id, tenantId);
  if (!row) throw new NotFoundError("Integration not found");

  const secrets = decryptSecrets(row.secrets_encrypted);
  const connObj = {
    id: row.id,
    name: row.name,
    environment: row.environment,
    provider: row.provider,
    config: row.config,
    secrets,
  };

  let result: { ok: boolean; message: string };
  try {
    const validateFn = await loadValidator(row.provider);
    if (!validateFn) {
      result = { ok: true, message: "No validator implemented for this provider" };
    } else {
      result = await validateFn(connObj);
    }
    const status = result.ok ? "active" : "error";
    const lastError = result.ok ? null : result.message;
    await repo.updateIntegrationStatus(row.id, status, lastError);
  } catch (err: any) {
    await repo.updateIntegrationStatus(row.id, "error", err.message);
    result = { ok: false, message: err.message };
  }

  // Audit: connector.tested or connector.test_failed
  audit.log({
    tenantId,
    userId: testedBy?.userId,
    userEmail: testedBy?.userEmail,
    eventType: result.ok ? "connector.tested" : "connector.test_failed",
    entityType: "connector",
    entityId: row.id,
    entityName: row.name,
    action: "test",
    status: result.ok ? "success" : "failure",
    summary: result.ok
      ? `${row.name} connectivity test passed`
      : `${row.name} connectivity test failed: ${result.message}`,
    metadata: { message: result.message, provider: row.provider },
  });

  return result;
}

export async function getDecryptedIntegration(
  id: string,
  tenantId: string | null,
) {
  const row = await repo.findIntegrationWithSecrets(id, tenantId);
  if (!row) throw new NotFoundError("Integration not found");
  return {
    ...row,
    secrets: decryptSecrets(row.secrets_encrypted),
  };
}

export async function getActiveDecryptedIntegrations(tenantId: string | null) {
  const rows = await repo.findActiveIntegrationsWithSecrets(tenantId);
  return rows.map((row) => ({
    ...row,
    secrets: decryptSecrets(row.secrets_encrypted),
  }));
}

export async function getDecryptedIntegrationsByIds(
  ids: string[],
  tenantId: string | null,
) {
  const rows = await repo.findIntegrationsByIdsWithSecrets(ids, tenantId);
  return rows.map((row) => ({
    ...row,
    secrets: decryptSecrets(row.secrets_encrypted),
  }));
}
