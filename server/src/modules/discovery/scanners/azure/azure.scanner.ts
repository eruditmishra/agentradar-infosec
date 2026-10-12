// @ts-nocheck
/**
 * Azure scanner (v2).
 *
 * The legacy ecosystem scanner in azure.deepscanner.ts (discoverAzureEcosystem)
 * is disabled from the live discovery path. This module is the only live
 * Azure discovery path (wired in discovery.service.ts).
 *
 * It does not invent hostnames. Foundry calls go to the project endpoint
 * Azure publishes on the Cognitive Services project. 404 means that route
 * is not the agent API (hub projects use /assistants). 403 means the
 * credential lacks Azure AI User on the account. Agent 365 is not required.
 *
 * discoverAzureScanner() below is the Entra Agent ID <-> Foundry correlation
 * core (unchanged). It also runs four supplementary collectors from
 * azure.deepscanner.ts for resource/agent categories that plane cannot see:
 *   - ARM sweep (discoverAzureConnector): Bot Service, Container Apps, AKS,
 *     ML workspaces, Web/Functions, VMs, generic AI resources. Its own
 *     Foundry-agent detection is filtered out of the merge — the Entra +
 *     Foundry-tag correlation above already covers Foundry agents with
 *     better (identity-linked) data, so keeping both would show duplicates.
 *   - discoverPowerPlatformAgents: Copilot Studio agents via Dataverse.
 *   - discoverTeamsAgentApps: Teams org app catalog bot/agent flags.
 *   - discoverAgent365CatalogForAzure: Agent 365 catalog (no-op unless
 *     AZURE_AGENT365_CATALOG_SCAN=true).
 *
 * Everything else previously exported from this file (validateAzureConnector,
 * discoverAzureEcosystem, discoverAzureConnector, etc.) is still re-exported
 * from azure.deepscanner.ts below for backward compatibility with any caller
 * that still imports it directly.
 */
import { ALLOW, safeFetch } from "../../../../utils/http";
import {
  discoverAzureConnector,
  discoverPowerPlatformAgents,
  discoverTeamsAgentApps,
  discoverAgent365CatalogForAzure,
  getContainerApp,
  extractSafeAppSignals,
} from "./azure.deepscanner";

/** Known agent frameworks whose signature can show up in a hosted agent's container image/env vars. */
const FRAMEWORK_HINT_RE =
  /langgraph|langchain|crewai|autogen|semantic.?kernel|llama.?index|haystack|autogpt/i;

const ARM_SCOPE = "https://management.azure.com/.default";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const AI_SCOPE = "https://ai.azure.com/.default";
const COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default";
const COGNITIVE_API = "2025-06-01";
const AGENT_ROUTES = [
  ["agents", "v1"],
  ["agents", "2025-05-01"],
  ["assistants", "2025-05-15-preview"],
  ["assistants", "2025-05-01"],
  ["assistants", "2024-07-01-preview"],
];

function sanitize(error) {
  return String(error?.message || error || "unknown error").slice(0, 500);
}

async function httpJson(url, token, policy) {
  const res = await safeFetch(
    url,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    policy,
  );
  const json = await res.json().catch(() => ({}));
  const error = json?.error?.message || json?.message || null;
  return { ok: res.ok, status: res.status, json, error };
}

async function accessToken(creds, scope) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope,
  });
  const res = await safeFetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    ALLOW.microsoftLogin,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      sanitize(
        json.error_description || json.error || `token failed (${res.status})`,
      ),
    );
  }
  return json.access_token;
}

export function parseFoundryTags(tags = []) {
  const out = {
    agentGuid: null,
    accountName: null,
    projectName: null,
    projectId: null,
    region: null,
  };
  for (const raw of Array.isArray(tags) ? tags : []) {
    const s = String(raw || "");
    const colon = s.indexOf(":");
    if (colon <= 0) continue;
    const key = s.slice(0, colon);
    const value = s.slice(colon + 1).trim();
    if (!value) continue;
    if (/^agentGuid$/i.test(key)) out.agentGuid = value;
    else if (/^region$/i.test(key)) out.region = value;
    else if (/^projectId$/i.test(key)) {
      out.projectId = value;
      const parts = value.split("@");
      out.accountName = parts[0] || null;
      out.projectName = parts[1] || null;
    }
  }
  return out;
}

export function inferFoundryName(displayName, tags = {}) {
  let name = String(displayName || "")
    .replace(/\s*\(Entra Agent ID\)\s*$/i, "")
    .replace(/-AgentIdentity$/i, "")
    .trim();
  const prefix =
    tags.accountName && tags.projectName
      ? `${tags.accountName}-${tags.projectName}-`
      : "";
  if (prefix && name.toLowerCase().startsWith(prefix.toLowerCase()))
    name = name.slice(prefix.length);
  return name || null;
}

/** ARM project name is often `account/project`. The data-plane name is the last segment. */
export function projectLeafName(project) {
  const fromId = String(project?.id || "")
    .split("/projects/")
    .pop();
  const name = String(project?.name || "");
  return (fromId || name.split("/").filter(Boolean).pop() || name).trim();
}

export function projectMatches(project, projectName) {
  const wanted = String(projectName || "").toLowerCase();
  if (!wanted) return false;
  const full = String(project?.name || "").toLowerCase();
  return full === wanted || projectLeafName(project).toLowerCase() === wanted;
}

export function projectEndpoints(project) {
  const props = project?.properties || {};
  const bag =
    props.endpoints && typeof props.endpoints === "object"
      ? props.endpoints
      : {};
  const urls = [];
  for (const value of [props.endpoint, ...Object.values(bag)]) {
    if (typeof value === "string" && /^https:\/\//i.test(value))
      urls.push(value.replace(/\/$/, ""));
  }
  return [...new Set(urls)];
}

export function explainStatus(status, error) {
  const text = String(error || "");
  const code =
    Number(status) || (/403/.test(text) ? 403 : /404/.test(text) ? 404 : 0);
  if (
    code === 401 ||
    code === 403 ||
    /forbidden|authorizationfailed/i.test(text)
  ) {
    return "403 Forbidden: sign-in worked, but this app cannot read Foundry agents. Azure AI Developer in this catalog only includes OpenAI data actions. Add a custom role whose data action is Microsoft.CognitiveServices/accounts/AIServices/agents/read.";
  }
  if (code === 404) {
    return "404 Not Found: this URL is not the agent route for the project. Hub projects (@AML) do not serve /agents?api-version=v1; the scanner uses the ARM project endpoint and then /assistants.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(text)) {
    return "DNS failed because a hostname was guessed from the resource name. This scanner does not guess hostnames.";
  }
  return null;
}

export function isHubProject(tags = {}) {
  const pid = String(tags.projectId || "").toUpperCase();
  return (
    pid.endsWith("@AML") ||
    pid.includes("@AML") ||
    Boolean(tags.virtualWorkspaceId)
  );
}

export function preferredAgentRoutes(tags = {}) {
  if (isHubProject(tags)) {
    return [
      ["assistants", "2025-05-15-preview"],
      ["assistants", "2025-05-01"],
      ["assistants", "2024-07-01-preview"],
      ["agents", "2025-05-01"],
      ["agents", "v1"],
    ];
  }
  return AGENT_ROUTES;
}

export function chatDeploymentModel(deployments = [], agentNameOrHint = "") {
  const candidates = [];
  for (const deployment of deployments || []) {
    const modelObj = deployment?.properties?.model;
    const modelName = String(modelObj?.name || deployment?.name || "").trim();
    if (!modelName || /embed|whisper|dall-e|^tts|audio|search/i.test(modelName))
      continue;
    candidates.push({
      deploymentName: String(deployment?.name || modelName),
      modelName,
      createdOrModified:
        deployment?.systemData?.lastModifiedAt ||
        deployment?.systemData?.createdAt ||
        null,
    });
  }
  if (!candidates.length) return null;
  const unique = [...new Set(candidates.map((c) => c.modelName))];
  if (unique.length === 1) return unique[0];

  if (agentNameOrHint) {
    const hintLc = String(agentNameOrHint).toLowerCase();
    const matched = candidates.find(
      (c) =>
        hintLc.includes(c.modelName.toLowerCase()) ||
        hintLc.includes(c.deploymentName.toLowerCase()),
    );
    if (matched) return matched.modelName;
  }

  const priorityList = [
    /gpt-4o$/i,
    /gpt-4o-mini/i,
    /gpt-4-turbo/i,
    /gpt-4/i,
    /o1/i,
    /o3/i,
    /gpt-35-turbo/i,
  ];
  for (const rx of priorityList) {
    const hit = candidates.find((c) => rx.test(c.modelName));
    if (hit) return hit.modelName;
  }

  return unique[0] || null;
}

const PLACEHOLDER_MODEL_RE =
  /microsoft-agent-identity|azure-foundry-agent|entra-agent-identity/i;

/**
 * Resolve the model a Foundry agent declares, in priority order:
 *   1. The agent definition's own `model`/`modelName` field (prompt agents).
 *   2. For a HOSTED agent whose definition carries its own
 *      `environment_variables`/`environmentVariables` (some hosted/container
 *      app agent definitions expose this inline, with no separate ARM call
 *      needed) — an explicit allowlist of model/deployment-name variables.
 *   3. A `tools[]` entry referencing another agent's model
 *      (`agent_reference.model`/`agent_reference.model_name`), for
 *      orchestrators that inherit a sub-agent's model.
 * Never returns a placeholder identity string (microsoft-agent-identity, etc).
 */
export function modelFromAgent(agent) {
  const latest = agent?.versions?.latest || agent?.version || {};
  const def = latest.definition || {};
  const raw =
    def.model || def.modelName || agent?.model || agent?.model_name || null;
  if (raw && typeof raw === "object") return raw.name || raw.id || null;
  const text = String(raw || "").trim();
  if (text && !PLACEHOLDER_MODEL_RE.test(text)) {
    return text;
  }

  // HostedAgentDefinition / ContainerAppAgentDefinition: check environment
  // variables carried directly on the agent definition itself.
  const env =
    def.environment_variables ||
    def.environmentVariables ||
    agent?.environment_variables ||
    {};
  if (typeof env === "object" && env !== null) {
    const envKeys = [
      "AZURE_OPENAI_DEPLOYMENT_NAME",
      "AZURE_OPENAI_MODEL_NAME",
      "AZURE_OPENAI_MODEL",
      "OPENAI_MODEL",
      "MODEL_NAME",
      "DEPLOYMENT_NAME",
      "CHAT_MODEL",
      "LLM_MODEL",
    ];
    for (const key of envKeys) {
      const val = String(env[key] || "").trim();
      if (val && !PLACEHOLDER_MODEL_RE.test(val)) {
        return val;
      }
    }
  }

  // Check tools array for agent_reference, model, or tool-level model definitions
  const tools = def.tools || agent?.tools || [];
  if (Array.isArray(tools)) {
    for (const t of tools) {
      if (!t || typeof t !== "object") continue;
      const toolModel =
        t.model ||
        t.model_name ||
        t.agent_reference?.model ||
        t.agent_reference?.model_name;
      if (
        toolModel &&
        typeof toolModel === "string" &&
        !PLACEHOLDER_MODEL_RE.test(toolModel.trim())
      ) {
        return toolModel.trim();
      }
    }
  }

  return null;
}

function agentNameOf(agent) {
  return (
    agent?.name || agent?.agent_name || agent?.versions?.latest?.name || null
  );
}

/** Stable dedupe/lookup key for a raw Foundry agent record: prefer its own id, fall back to name. */
export function foundryAgentKey(agent) {
  const id = agent?.id || agent?.agent_id || null;
  if (id) return `id:${String(id)}`;
  const name = agentNameOf(agent);
  return name ? `name:${String(name).toLowerCase()}` : null;
}

/**
 * Extract references to other agents this agent's definition invokes as a
 * tool (Azure AI Foundry "connected agent" pattern). Schema is not fully
 * documented publicly, so this matches defensively on tool `type` containing
 * "connected agent" / "sub agent" and reads the nested agent ref from any of
 * the field-name variants Azure has used (connected_agent / connectedAgent /
 * agent), rather than one exact shape.
 */
export function extractConnectedAgentRefs(agent) {
  const latest = agent?.versions?.latest || agent?.version || {};
  const tools = latest?.definition?.tools || agent?.tools || [];
  const refs = [];
  for (const tool of Array.isArray(tools) ? tools : []) {
    const type = String(tool?.type || tool?.kind || "").toLowerCase();
    if (!/connected.?agent|sub.?agent/.test(type)) continue;
    const nested =
      tool?.connected_agent || tool?.connectedAgent || tool?.agent || tool;
    const id =
      nested?.id || nested?.agent_id || nested?.agentId || null;
    const name =
      nested?.name || nested?.agent_name || nested?.agentName || null;
    if (id || name) refs.push({ id, name });
  }
  return refs;
}

export function resolveAgentKeyByRef(ref, rawAgentsByKey) {
  if (ref.id) {
    const byId = `id:${String(ref.id)}`;
    if (rawAgentsByKey.has(byId)) return byId;
  }
  if (ref.name) {
    const byName = `name:${String(ref.name).toLowerCase()}`;
    if (rawAgentsByKey.has(byName)) return byName;
  }
  return null;
}

/**
 * Whether an ARM-sweep observation belongs in the merged agent inventory
 * (see discoverAzureScanner's "Supplementary collectors" section): only
 * actual agent detections, excluding the sweep's own (lower-fidelity)
 * Foundry-agent detection, and excluding a Container App already confirmed
 * as a specific hosted Foundry agent's runtime (better data — would
 * otherwise duplicate).
 */
export function isArmSweepAgentKept(observation, hostedContainerAppIds) {
  return Boolean(
    observation?.metadata?.inventoryClass === "ai_cloud_agent" &&
      observation?.metadata?.discoveryMode !== "azure-agent-api" &&
      !hostedContainerAppIds.has(
        String(observation?.metadata?.azureResourceId || "").toLowerCase(),
      ),
  );
}

/**
 * A Foundry agent's `definition.kind` can be "hosted"/"container_app" — the
 * agent's actual code (e.g. a LangGraph/LangChain graph) runs inside an Azure
 * Container App the definition points to via `container_app_resource_id`,
 * rather than Foundry running a prompt/tool-call loop itself.
 */
export function foundryAgentHostedInfo(agent) {
  const latest = agent?.versions?.latest || agent?.version || {};
  const def = latest?.definition || {};
  return {
    kind: def.kind || agent?.kind || agent?.object || null,
    containerAppResourceId:
      def.container_app_resource_id ||
      def.containerAppResourceId ||
      agent?.container_app_resource_id ||
      null,
  };
}

/**
 * Explicit allowlist of non-secret environment variable NAMES that commonly
 * carry model/provider configuration for a hosted agent (LangGraph/LangChain/
 * etc. running inside the Container App). This is intentionally NOT "read
 * every non-secret env var" — only these specific, documented names are ever
 * read, and only their literal `value` (never a `secretRef`-backed value).
 *
 * Not exhaustive by design — extend as new frameworks/providers come up.
 */
/**
 * Runtime-observed model discovery — NOT IMPLEMENTED.
 *
 * A hosted agent's *declared* configuration (below) can miss models chosen
 * dynamically in code, via a router/fallback chain, or per-request. The only
 * way to see those is runtime telemetry from inside the container
 * (OpenTelemetry GenAI spans / Application Insights dependency telemetry
 * tagging the model actually called). CT Agent Radar has no Application
 * Insights / Azure Monitor / OpenTelemetry ingestion path today (verified:
 * no such integration exists anywhere in this codebase), so this is left as
 * a defined-but-unbuilt contract rather than faked:
 *
 *   - discoveryStatus: "observed"
 *   - discoverySource: "runtime_telemetry"
 *   - Same {provider, modelName, modelVersion, deploymentName, endpoint}
 *     shape as a declared entry, plus `observedAt` (ISO timestamp) and
 *     `agentVersion` (Foundry agent version the call was correlated to).
 *   - Never persist prompts, completions, or other request/response payload
 *     content — span/metric metadata (model id, token counts, timestamps)
 *     only.
 *
 * To build this: the customer's Container App must export GenAI spans (e.g.
 * via the OpenTelemetry GenAI semantic conventions) to an Application
 * Insights resource this connector's service principal can read
 * (Monitoring Reader on that resource), and a new collector would query the
 * `AppDependencies`/`AppTraces` tables (or the OTLP-native trace API) for
 * spans tagged with this agent's Foundry agent id, extract model identifiers
 * from span attributes, and merge them into `metadata.hostedRuntime.models`
 * alongside (never overwriting) the declared entries this file produces.
 * This does not require the customer to change their container.
 */
const MODEL_ENV_VAR_MAP = {
  // Azure OpenAI
  AZURE_OPENAI_ENDPOINT: { provider: "azure_openai", field: "endpoint" },
  AZURE_OPENAI_API_BASE: { provider: "azure_openai", field: "endpoint" },
  AZURE_OPENAI_DEPLOYMENT: { provider: "azure_openai", field: "deploymentName" },
  AZURE_OPENAI_DEPLOYMENT_NAME: {
    provider: "azure_openai",
    field: "deploymentName",
  },
  AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: {
    provider: "azure_openai",
    field: "deploymentName",
  },
  AZURE_OPENAI_MODEL: { provider: "azure_openai", field: "modelName" },
  AZURE_OPENAI_MODEL_NAME: { provider: "azure_openai", field: "modelName" },

  // OpenAI (reclassified to azure_openai below if OPENAI_API_TYPE=azure or
  // the endpoint host is actually an Azure OpenAI/AI Services domain — the
  // langchain-openai / openai-python "azure via OPENAI_* vars" pattern).
  OPENAI_API_BASE: { provider: "openai", field: "endpoint" },
  OPENAI_BASE_URL: { provider: "openai", field: "endpoint" },
  OPENAI_MODEL: { provider: "openai", field: "modelName" },
  OPENAI_MODEL_NAME: { provider: "openai", field: "modelName" },
  OPENAI_DEPLOYMENT_NAME: { provider: "openai", field: "deploymentName" },
  OPENAI_API_TYPE: { provider: "openai", field: "apiType" },

  // Anthropic
  ANTHROPIC_MODEL: { provider: "anthropic", field: "modelName" },
  ANTHROPIC_BASE_URL: { provider: "anthropic", field: "endpoint" },
  CLAUDE_MODEL: { provider: "anthropic", field: "modelName" },

  // Google Gemini / Vertex AI
  GOOGLE_MODEL: { provider: "google", field: "modelName" },
  GEMINI_MODEL: { provider: "google", field: "modelName" },
  VERTEX_AI_MODEL: { provider: "google", field: "modelName" },
  VERTEXAI_MODEL: { provider: "google", field: "modelName" },

  // AWS Bedrock — region alone never identifies a model (see below), only
  // recorded as supporting evidence alongside an actual model id.
  BEDROCK_MODEL_ID: { provider: "aws", field: "modelName" },
  BEDROCK_MODEL: { provider: "aws", field: "modelName" },
  AWS_REGION: { provider: "aws", field: "region" },
  AWS_DEFAULT_REGION: { provider: "aws", field: "region" },

  // Other providers already supported elsewhere in CT Agent Radar
  COHERE_MODEL: { provider: "cohere", field: "modelName" },
  MISTRAL_MODEL: { provider: "mistral", field: "modelName" },
};

const AZURE_OPENAI_HOST_RE =
  /\.openai\.azure\.com$|\.services\.ai\.azure\.com$|\.cognitiveservices\.azure\.com$/i;

function safeHostname(url) {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return null;
  }
}

/** True only when the env entry is a literal, non-secretRef-backed value. */
function readAllowlistedEnvValue(env, allow) {
  const name = String(env?.name || env?.Name || "").trim();
  if (!name) return null;
  const mapping = allow[name.toUpperCase()];
  if (!mapping) return null;
  // Never read a Container Apps secret reference, even if the name matches
  // the allowlist — this only ever reads a literal, already-non-secret value.
  if (env?.secretRef) return null;
  const value = typeof env?.value === "string" ? env.value.trim() : "";
  if (!value) return null;
  return { name, ...mapping, value };
}

/**
 * Extract model/provider configuration declared on a hosted agent's
 * Container App — this is where the real model calls happen (LangGraph/
 * LangChain/etc. graph code), not in the outer Foundry agent definition.
 *
 * Reads ONLY literal values for the explicit MODEL_ENV_VAR_MAP allowlist.
 * Never reads secretRef-backed values, never reads arbitrary env vars, never
 * persists the full ARM response. A deployment name is never reported as a
 * modelName — if the two can't be positively linked (via `accountDeployments`,
 * an ARM deployment list already fetched elsewhere in this scanner), the
 * model is recorded as `unresolved` with the deployment name kept separate.
 */
export function extractHostedModelConfiguration(
  containerAppJson,
  { accountDeployments = [] } = {},
) {
  const props = containerAppJson?.properties || containerAppJson || {};
  const template = props.template || {};
  const containers = [
    ...(template.containers || []),
    ...(template.initContainers || []),
  ];

  const byProvider = new Map();
  for (const c of containers) {
    for (const env of c.env || []) {
      const hit = readAllowlistedEnvValue(env, MODEL_ENV_VAR_MAP);
      if (!hit) continue;
      const bucket = byProvider.get(hit.provider) || { sourceVars: [] };
      bucket[hit.field] = hit.value;
      bucket.sourceVars.push(hit.name);
      byProvider.set(hit.provider, bucket);
    }
  }

  const models = [];
  for (const [providerGuess, fields] of byProvider) {
    let provider = providerGuess;
    const looksAzureHosted =
      fields.apiType === "azure" ||
      AZURE_OPENAI_HOST_RE.test(safeHostname(fields.endpoint) || "");
    if (provider === "openai" && looksAzureHosted) provider = "azure_openai";

    // A bare AWS region is supporting context, never a model on its own.
    if (provider === "aws" && !fields.modelName && !fields.deploymentName) {
      continue;
    }

    let modelName = fields.modelName || null;
    const deploymentName = fields.deploymentName || null;
    let discoverySource = "container_app_environment";
    let confidence = modelName ? "high" : "low";

    // A deployment name is NOT a model name — only resolve it via an actual
    // ARM deployment record on the same Cognitive Services account (reusing
    // chatDeploymentModel, the same resolution already used for the outer
    // Foundry agent's model fallback elsewhere in this scanner).
    if (!modelName && deploymentName && accountDeployments.length) {
      const matchesByName = accountDeployments.some(
        (d) =>
          String(d?.name || "").toLowerCase() === deploymentName.toLowerCase(),
      );
      const resolved = matchesByName
        ? chatDeploymentModel(accountDeployments, deploymentName)
        : null;
      if (resolved) {
        modelName = resolved;
        confidence = "high";
        discoverySource = "container_app_environment+arm_deployment_lookup";
      }
    }

    if (!modelName && !deploymentName && !fields.endpoint) continue; // nothing usable

    models.push({
      provider,
      modelName,
      modelVersion: null,
      deploymentName,
      endpoint: fields.endpoint || null,
      discoverySource,
      discoveryStatus: modelName ? "declared" : "unresolved",
      confidence,
      sourceVars: fields.sourceVars,
    });
  }
  return models;
}

/**
 * Read the hosted agent's underlying Container App: check its image/env vars
 * for a known agent-framework signature (LangGraph, LangChain, CrewAI,
 * AutoGen, Semantic Kernel, ...), AND extract any model/provider
 * configuration declared via the MODEL_ENV_VAR_MAP allowlist above. Only env
 * var *names* are used for framework detection (never values); only the
 * explicit model-config allowlist ever has its values read, and never for a
 * secretRef-backed variable.
 */
export async function resolveHostedRuntime(
  armToken,
  containerAppResourceId,
  { accountDeployments = [], getContainerAppFn = getContainerApp } = {},
) {
  if (!armToken || !containerAppResourceId) return null;
  const result = await getContainerAppFn(armToken, {
    id: containerAppResourceId,
  });
  if (!result?.ok) {
    return {
      containerAppResourceId,
      ok: false,
      error: sanitize(result?.error || "Container App not readable"),
      models: [],
    };
  }
  const signals = extractSafeAppSignals(result.json);
  const blob = [
    signals.images.join(" "),
    signals.envNames.join(" "),
    signals.kind,
    signals.linuxFx,
    Object.keys(signals.tags || {}).join(" "),
    Object.values(signals.tags || {}).join(" "),
  ].join(" ");
  const match = FRAMEWORK_HINT_RE.exec(blob);
  const models = extractHostedModelConfiguration(result.json, {
    accountDeployments,
  });
  return {
    containerAppResourceId,
    ok: true,
    runningStatus: signals.runningStatus,
    provisioningState: signals.provisioningState,
    images: signals.images,
    envNames: signals.envNames,
    detectedFramework: match ? match[0].toLowerCase() : null,
    models,
  };
}

function unwrapList(json) {
  if (Array.isArray(json)) return json;
  const raw = json?.data || json?.value || json?.agents || [];
  return Array.isArray(raw) ? raw : [];
}

async function readCollection(dataToken, endpoint, path, apiVersion, request) {
  const url = `${endpoint}/${path}?api-version=${apiVersion}&limit=100`;
  try {
    const result = await request(dataToken, url);
    if (!result.ok) return { ...result, agents: [] };
    return { ok: true, status: result.status, agents: unwrapList(result.json) };
  } catch (err) {
    return { ok: false, status: 0, agents: [], error: sanitize(err) };
  }
}

export async function readFoundryAgents(
  dataToken,
  endpoint,
  request,
  routes = AGENT_ROUTES,
) {
  let last = { ok: false, agents: [], error: "Foundry read failed" };
  for (const [path, apiVersion] of routes) {
    const result = await readCollection(
      dataToken,
      endpoint,
      path,
      apiVersion,
      request,
    );
    if (result.ok && result.agents.length) return result;
    last = result.ok ? result : { ...result, agents: [] };
    if (result.status === 401 || result.status === 403) return last;
    if (/ENOTFOUND|getaddrinfo/i.test(String(result.error || ""))) return last;
  }
  return last;
}

function pickAgent(agents, tags, inferred) {
  const guid = String(tags.agentGuid || "").toLowerCase();
  const name = String(inferred || "").toLowerCase();
  return (
    (agents || []).find(
      (agent) => guid && String(agent.id || "").toLowerCase() === guid,
    ) ||
    (agents || []).find(
      (agent) =>
        name && String(agentNameOf(agent) || "").toLowerCase() === name,
    ) ||
    null
  );
}

function observation({
  conn,
  tenantId,
  sp,
  tags,
  inferred,
  model,
  modelSource,
  evidence,
  lastError,
  lastStatus,
  foundryAgentId = null,
  agentKind = null,
  hostedRuntime = null,
}) {
  const entraName = sp.displayName || sp.id;
  const name = inferred || entraName;
  const isRestricted =
    modelSource === "permission_denied" ||
    lastStatus === 401 ||
    lastStatus === 403 ||
    (lastError && /403|denied|forbidden/i.test(lastError));
  const isUnreachable =
    modelSource === "foundry_unreadable" ||
    lastStatus === 404 ||
    (lastError && /404|not found/i.test(lastError));
  const modelAccessStatus = model
    ? "available"
    : isRestricted
      ? "restricted_403"
      : isUnreachable
        ? "unreachable_404"
        : "missing";
  const remediationGuide = model
    ? null
    : isRestricted
      ? `Assign 'Cognitive Services OpenAI User' or 'Azure AI User' to connector App on ${tags.accountName || "the Cognitive Services account"} to reveal model definition.`
      : isUnreachable
        ? `Foundry data plane could not be reached on ${tags.accountName || "the Cognitive Services account"}. Verify project endpoint mapping.`
        : null;

  return {
    collector_id: "identity_entra_agent",
    fingerprint: `entra-agent-id:${tenantId}:${sp.id}`,
    name,
    category: "identity",
    provider: "entra_agent_id",
    cloud_provider: "azure",
    deployment_type: "identity",
    region: tags.region || "global",
    running_status: sp.accountEnabled === false ? "disabled" : "unknown",
    confidence_score: 0.95,
    framework: "entra-agent-identity",
    model: model || null,
    metadata: {
      connectorId: conn.id,
      connectorName: conn.name,
      environment: conn.environment,
      discoveryMode: "azure-scanner-v2",
      discoveryLayer: "agent",
      inventoryClass: "ai_cloud_agent",
      evidenceClass: "platform_agent",
      agentStatus: "confirmed",
      aiRelevant: true,
      cloudProvider: "azure",
      tenantId,
      objectId: sp.id,
      foundryAgentId,
      agentKind,
      hostedRuntime,
      tags: sp.tags || [],
      foundryLink: { ...tags, inferredAgentName: inferred },
      entraDisplayName: entraName,
      agentName: name,
      modelSource: modelSource || "unknown",
      foundationModel: model || null,
      modelAccessStatus,
      remediationGuide,
      evidence,
      deep: {
        schemaVersion: "azure-scanner-v2",
        deepScan: "azure_scanner_v2",
        displayName: name,
        foundationModel: model || null,
        modelAccessStatus,
        remediationGuide,
        agentId: sp.id,
        provider: "entra_agent_id",
      },
    },
    relationships: [
      {
        rel_type: "OBSERVED_BY",
        to_type: "IdentityProvider",
        to_key: "entra-id",
        to_name: "Microsoft Entra ID",
      },
      ...(hostedRuntime?.ok
        ? [
            {
              rel_type: "HOSTED_ON",
              to_type: "AzureContainerApp",
              to_key: hostedRuntime.containerAppResourceId,
              to_name:
                hostedRuntime.containerAppResourceId.split("/").pop() || "",
            },
          ]
        : []),
    ],
  };
}

/**
 * A Foundry agent found by listing a project's /agents collection directly,
 * with no Entra Agent ID service principal of its own — the common shape
 * for a "connected agent" / sub-agent that only exists to be invoked as a
 * tool by an orchestrator agent, and so was never a candidate for the
 * identity-driven `observation()` above.
 */
function foundryOnlyAgentObservation({
  conn,
  tenantId,
  accountName,
  projectName,
  agentId,
  name,
  model,
  subAgents,
  calledByAgents,
  agentKind = null,
  hostedRuntime = null,
}) {
  const isSubAgent = calledByAgents.length > 0;
  return {
    collector_id: "identity_entra_agent",
    fingerprint: `foundry-agent:${tenantId}:${accountName}:${projectName}:${agentId}`,
    name,
    category: "agent",
    provider: "azure_ai_foundry",
    cloud_provider: "azure",
    deployment_type: "agent",
    region: "global",
    running_status: "unknown",
    confidence_score: isSubAgent ? 0.85 : 0.9,
    framework: "azure-foundry-agent",
    model: model || null,
    metadata: {
      connectorId: conn.id,
      connectorName: conn.name,
      environment: conn.environment,
      discoveryMode: "azure-scanner-v2-foundry-direct",
      discoveryLayer: "agent",
      inventoryClass: "ai_cloud_agent",
      evidenceClass: "platform_agent",
      agentStatus: "confirmed",
      aiRelevant: true,
      cloudProvider: "azure",
      tenantId,
      foundryAgentId: agentId,
      agentKind,
      hostedRuntime,
      foundryLink: { accountName, projectName },
      agentName: name,
      modelSource: model ? "azure_foundry_agents" : "unknown",
      foundationModel: model || null,
      modelAccessStatus: model ? "available" : "missing",
      isSubAgent,
      subAgents,
      calledByAgents,
      evidence: [
        "Listed directly via the Foundry project /agents endpoint (azure scanner v2, direct pass).",
        "No Entra Agent ID service principal was found for this agent — typical for a connected-agent/sub-agent invoked only as a tool by another agent.",
        ...(isSubAgent
          ? [
              `Invoked as a sub-agent by: ${calledByAgents.map((a) => a.name || a.agentId).join(", ")}`,
            ]
          : []),
        ...(subAgents.length
          ? [
              `Invokes sub-agent(s): ${subAgents.map((a) => a.name || a.agentId).join(", ")}`,
            ]
          : []),
        ...(hostedRuntime?.ok
          ? [
              `Hosted agent container running_status=${hostedRuntime.runningStatus || "unknown"}${hostedRuntime.detectedFramework ? `, framework=${hostedRuntime.detectedFramework}` : ""}`,
              ...(hostedRuntime.models?.length
                ? [
                    `Model config found in container env: ${hostedRuntime.models.map((m) => `${m.provider}/${m.modelName || m.deploymentName || "unresolved"}`).join(", ")}`,
                  ]
                : []),
            ]
          : hostedRuntime
            ? [
                `Hosted agent container reference present but unreadable: ${hostedRuntime.error}`,
              ]
            : []),
      ],
      deep: {
        schemaVersion: "azure-scanner-v2",
        deepScan: "azure_scanner_v2_foundry_direct",
        displayName: name,
        foundationModel: model || null,
        agentId,
        provider: "azure_ai_foundry",
      },
    },
    relationships: [
      ...subAgents.map((a) => ({
        rel_type: "CALLS_AGENT",
        to_type: "Agent",
        to_key: a.agentId,
        to_name: a.name || a.agentId,
      })),
      ...calledByAgents.map((a) => ({
        rel_type: "CALLED_BY_AGENT",
        to_type: "Agent",
        to_key: a.agentId,
        to_name: a.name || a.agentId,
      })),
      ...(hostedRuntime?.ok
        ? [
            {
              rel_type: "HOSTED_ON",
              to_type: "AzureContainerApp",
              to_key: hostedRuntime.containerAppResourceId,
              to_name:
                hostedRuntime.containerAppResourceId.split("/").pop() || "",
            },
          ]
        : []),
    ],
  };
}

async function defaultGraphIdentities(token) {
  const result = await httpJson(
    "https://graph.microsoft.com/v1.0/servicePrincipals/microsoft.graph.agentIdentity",
    token,
    ALLOW.graphMicrosoft,
  );
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      items: [],
      error: sanitize(
        result.json?.error?.message || `Graph failed (${result.status})`,
      ),
    };
  }
  return { ok: true, status: 200, items: result.json.value || [] };
}

const ARM_PAGE_LIMIT = 20;

/**
 * Azure often returns an empty first page plus nextLink. Stopping on page 1
 * hides Foundry accounts that appear on later pages.
 */
export async function collectArmPageValues(
  startUrl,
  fetchPage,
  { maxPages = ARM_PAGE_LIMIT } = {},
) {
  const items = [];
  let next = startUrl;
  const seen = new Set();
  for (let page = 0; page < maxPages && next; page += 1) {
    if (seen.has(next)) break;
    seen.add(next);
    const pageResult = await fetchPage(next);
    if (!pageResult?.ok) {
      if (page === 0) return [];
      break;
    }
    items.push(...(pageResult.value || []));
    next = pageResult.nextLink || null;
  }
  return items;
}

async function listArmValues(token, url) {
  return collectArmPageValues(url, async (pageUrl) => {
    const result = await httpJson(pageUrl, token, ALLOW.azureArm);
    return {
      ok: result.ok,
      value: result.json?.value || [],
      nextLink: result.json?.nextLink || null,
    };
  });
}

async function defaultArmAccounts(token, subscriptionId) {
  return listArmValues(
    token,
    `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CognitiveServices/accounts?api-version=${COGNITIVE_API}`,
  );
}

async function defaultProjects(token, account) {
  const id = String(account?.id || "");
  if (!id) return [];
  return listArmValues(
    token,
    `https://management.azure.com${id}/projects?api-version=${COGNITIVE_API}`,
  );
}

async function defaultDeployments(token, account) {
  const id = String(account?.id || "");
  if (!id) return [];
  return listArmValues(
    token,
    `https://management.azure.com${id}/deployments?api-version=${COGNITIVE_API}`,
  );
}

async function defaultDataGet(token, url) {
  let policy = ALLOW.azureAiServices;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("openai.azure.com")) policy = ALLOW.azureOpenAi;
    else if (host === "management.azure.com") policy = ALLOW.azureArm;
  } catch {
    /* request will fail closed */
  }
  return httpJson(url, token, policy);
}

export async function probeFoundryAgentReadCapability(conn, deps = {}) {
  const creds = {
    tenantId: conn?.config?.tenantId,
    clientId: conn?.config?.clientId,
    clientSecret: conn?.secrets?.clientSecret,
  };
  const subscriptionId = conn?.config?.subscriptionId;
  const getToken = deps.getToken || accessToken;
  const listAccounts =
    deps.listAccounts ||
    (async (token) => defaultArmAccounts(token, subscriptionId));
  const listProjects = deps.listProjects || defaultProjects;
  const request = deps.request || defaultDataGet;

  let armToken = null;
  let dataToken = null;
  try {
    armToken = await getToken(creds, ARM_SCOPE);
  } catch (err) {
    return { ok: false, message: `ARM auth failed: ${sanitize(err)}` };
  }

  try {
    dataToken =
      (await getToken(creds, AI_SCOPE).catch(() => null)) ||
      (await getToken(creds, COGNITIVE_SCOPE).catch(() => null));
  } catch {
    dataToken = null;
  }

  if (!dataToken) {
    return {
      ok: false,
      message:
        "foundryAgentRead=false: no Azure AI data-plane token could be acquired. Assign Azure AI User or Cognitive Services OpenAI User.",
    };
  }

  const accounts = await listAccounts(armToken);
  if (!accounts?.length) {
    return {
      ok: false,
      message:
        "foundryAgentRead=false: no Cognitive Services or Foundry accounts visible in this subscription.",
    };
  }

  let lastError = null;
  for (const account of accounts.slice(0, 5)) {
    const projects = await listProjects(armToken, account);
    for (const project of (projects || []).slice(0, 3)) {
      const endpoints = projectEndpoints(project);
      for (const endpoint of endpoints) {
        const result = await readFoundryAgents(
          dataToken,
          endpoint,
          (token, url) => request(token, url),
        );
        if (result.ok) {
          return {
            ok: true,
            accountName: account.name,
            projectName: project.name,
            agentCount: (result.agents || []).length,
            message: `foundryAgentRead=true on ${account.name}/${project.name} (${(result.agents || []).length} agents listed).`,
          };
        }
        lastError = result.error || lastError;
      }
    }
  }

  return {
    ok: false,
    message:
      lastError ||
      "foundryAgentRead=false: could not read any project agents endpoint.",
  };
}

/**
 * Live Azure scan. Dependencies are injectable for tests.
 */
export async function discoverAzureScanner(conn, deps = {}) {
  const creds = {
    tenantId: conn?.config?.tenantId,
    clientId: conn?.config?.clientId,
    clientSecret: conn?.secrets?.clientSecret,
  };
  const subscriptionId = conn?.config?.subscriptionId;
  const tenantId = creds.tenantId;
  const discoveryErrors = [];
  const observations = [];

  if (
    !creds.tenantId ||
    !creds.clientId ||
    !creds.clientSecret ||
    !subscriptionId
  ) {
    discoveryErrors.push({
      collector: "azure-scanner-v2",
      discoveryStatus: "error",
      error:
        "Azure connector missing tenantId, clientId, clientSecret, or subscriptionId",
    });
    return {
      observations,
      discoveryErrors,
      stats: { agentsDiscovered: 0, discoveryErrors: 1 },
    };
  }

  const getToken = deps.getToken || accessToken;
  let graphToken = null;
  let armToken = null;
  let dataToken = null;
  try {
    graphToken = await getToken(creds, GRAPH_SCOPE);
  } catch (err) {
    discoveryErrors.push({
      collector: "azure-scanner-v2",
      discoveryType: "graph-token",
      discoveryStatus: "error",
      error: sanitize(err),
    });
  }
  try {
    armToken = await getToken(creds, ARM_SCOPE);
  } catch (err) {
    discoveryErrors.push({
      collector: "azure-scanner-v2",
      discoveryType: "arm-token",
      discoveryStatus: "error",
      error: sanitize(err),
    });
  }
  try {
    dataToken =
      (await getToken(creds, AI_SCOPE).catch(() => null)) ||
      (await getToken(creds, COGNITIVE_SCOPE).catch(() => null));
  } catch {
    dataToken = null;
  }
  if (!dataToken) {
    discoveryErrors.push({
      collector: "azure-scanner-v2",
      discoveryType: "foundry-token",
      discoveryStatus: "error",
      error:
        "No Azure AI data-plane token. Assign Azure AI User or Cognitive Services OpenAI User on the Foundry account.",
    });
  }

  const listIdentities =
    deps.listIdentities ||
    (graphToken
      ? () => defaultGraphIdentities(graphToken)
      : async () => ({ ok: false, items: [], error: "no graph token" }));
  const listAccounts =
    deps.listAccounts ||
    (armToken
      ? () => defaultArmAccounts(armToken, subscriptionId)
      : async () => []);
  const listProjects =
    deps.listProjects ||
    (armToken
      ? (account) => defaultProjects(armToken, account)
      : async () => []);
  const listDeployments =
    deps.listDeployments ||
    (armToken
      ? (account) => defaultDeployments(armToken, account)
      : async () => []);
  const request = deps.request || defaultDataGet;
  const getContainerAppFn = deps.getContainerApp || getContainerApp;

  // Cognitive Services deployment lists, fetched at most once per account —
  // used to resolve a hosted agent's declared *deployment* name (from its
  // Container App env vars) to the actual underlying *model* name.
  const deploymentsByAccountCache = new Map();
  async function getAccountDeployments(account) {
    if (!account) return [];
    const key = account.id || account.name;
    if (!deploymentsByAccountCache.has(key)) {
      deploymentsByAccountCache.set(key, await listDeployments(account));
    }
    return deploymentsByAccountCache.get(key);
  }

  const identityResult = await listIdentities();
  if (!identityResult.ok) {
    const status = identityResult.status;
    discoveryErrors.push({
      collector: "azure-scanner-v2",
      discoveryType: "entra-agent-id",
      discoveryStatus:
        status === 401 || status === 403 ? "permission_denied" : "error",
      error:
        status === 403
          ? "403 Forbidden listing Entra Agent ID. Grant application permission AgentIdentity.Read.All and admin consent."
          : identityResult.error || "Entra Agent ID list failed",
    });
  }

  const accounts = await listAccounts();
  const projectCache = new Map();

  for (const sp of identityResult.items || []) {
    const tags = parseFoundryTags(sp.tags || []);
    let inferred =
      tags.accountName && tags.projectName
        ? inferFoundryName(sp.displayName, tags)
        : null;
    const evidence = [
      "Listed via Microsoft Graph agentIdentity (azure scanner v2).",
      "Entra Agent ID does not carry the foundation model.",
    ];
    let model = null;
    let modelSource = inferred ? "foundry_unreadable" : "unknown";
    let matched = null;
    let hostedInfo = { kind: null, containerAppResourceId: null };
    let hostedRuntime = null;

    const account = (accounts || []).find(
      (item) =>
        String(item.name || "").toLowerCase() ===
        String(tags.accountName || "").toLowerCase(),
    );
    let endpoints = [];
    if (account && tags.projectName) {
      const cacheKey = `${account.id || account.name}:${tags.projectName}`;
      if (!projectCache.has(cacheKey)) {
        const projects = await listProjects(account);
        const named = (projects || []).find((project) =>
          projectMatches(project, tags.projectName),
        );
        projectCache.set(cacheKey, {
          endpoints: projectEndpoints(named),
          account,
        });
      }
      endpoints = projectCache.get(cacheKey).endpoints;
    }

    if (inferred && !endpoints.length) {
      evidence.push(
        `No ARM project endpoint for ${tags.accountName}/${tags.projectName}. A hostname was not guessed; guessed hosts are what returned 404 and ENOTFOUND.`,
      );
    }

    let last = null;
    if (dataToken && endpoints.length) {
      const routes = preferredAgentRoutes(tags);
      for (const endpoint of endpoints) {
        const listed = await readFoundryAgents(
          dataToken,
          endpoint,
          (token, url) => request(token, url),
          routes,
        );
        last = listed;
        if (listed.status === 401 || listed.status === 403) break;
        matched = pickAgent(listed.agents, tags, inferred);
        if (matched) break;
      }
      if (matched) {
        model = modelFromAgent(matched);
        const foundryName = agentNameOf(matched);
        if (foundryName)
          evidence.push(
            `Agent name ${foundryName} read from the Foundry project endpoint.`,
          );

        hostedInfo = foundryAgentHostedInfo(matched);
        if (hostedInfo.containerAppResourceId) {
          const accountDeployments = await getAccountDeployments(account);
          hostedRuntime = await resolveHostedRuntime(
            armToken,
            hostedInfo.containerAppResourceId,
            { accountDeployments, getContainerAppFn },
          );
          if (hostedRuntime?.ok) {
            evidence.push(
              `Hosted agent container running_status=${hostedRuntime.runningStatus || "unknown"}${hostedRuntime.detectedFramework ? `, framework=${hostedRuntime.detectedFramework}` : ""}`,
            );
            if (hostedRuntime.models?.length) {
              evidence.push(
                `Model config found in container env: ${hostedRuntime.models.map((m) => `${m.provider}/${m.modelName || m.deploymentName || "unresolved"}`).join(", ")}`,
              );
              // The Foundry agent definition itself had no model — fall back
              // to a declared, resolved model found in the container's own
              // env vars before giving up on this identity's model entirely.
              if (!model) {
                const declared = hostedRuntime.models.find(
                  (m) => m.discoveryStatus === "declared" && m.modelName,
                );
                if (declared) model = declared.modelName;
              }
            }
          } else if (hostedRuntime) {
            evidence.push(
              `Hosted agent container reference present but unreadable: ${hostedRuntime.error}`,
            );
          }
        }

        if (model) {
          modelSource = "azure_foundry_agents";
          evidence.push(
            `Foundation model ${model} read from the Foundry definition.`,
          );
          observations.push(
            observation({
              conn,
              tenantId,
              sp,
              tags,
              inferred: foundryName,
              model,
              modelSource,
              evidence,
              lastError: last?.error,
              lastStatus: last?.status,
              foundryAgentId: foundryAgentKey(matched),
              agentKind: hostedInfo.kind,
              hostedRuntime,
            }),
          );
          continue;
        }

        evidence.push(
          "Foundry agent was found, but its definition did not include a model.",
        );
        // Do not continue early! Fall through so hosted agents and unmodeled
        // definitions can still inherit the Cognitive Account's chat
        // deployment fallback below (e.g. gpt-4o).
        if (foundryName) inferred = foundryName;
      } else if (last && !last.ok) {
        const why = explainStatus(last.status, last.error);
        evidence.push(last.error || "Foundry read failed");
        if (why) evidence.push(why);
        discoveryErrors.push({
          collector: "azure-scanner-v2",
          discoveryType: "foundry-project",
          discoveryStatus:
            last.status === 401 || last.status === 403
              ? "permission_denied"
              : "error",
          error: why || last.error,
          accountName: tags.accountName,
          projectName: tags.projectName,
        });
      }
    }

    if (!model && account) {
      const deploymentModel = chatDeploymentModel(
        await listDeployments(account),
        inferred || tags.agentGuid,
      );
      if (deploymentModel) {
        model = deploymentModel;
        modelSource = "azure_cognitive_deployment";
        evidence.push(
          `Foundation model ${deploymentModel} mapped from chat deployment on ${account.name}. The agent definition was not returned by data plane.`,
        );
      }
    }

    if (inferred)
      evidence.push(`Inventory name set to Foundry agent ${inferred}.`);
    observations.push(
      observation({
        conn,
        tenantId,
        sp,
        tags,
        inferred,
        model,
        modelSource,
        evidence,
        lastError: last?.error,
        lastStatus: last?.status,
        foundryAgentId: matched ? foundryAgentKey(matched) : null,
        agentKind: hostedInfo.kind,
        hostedRuntime,
      }),
    );
  }

  // --- Phase 2: direct per-project agent listing + sub-agent linking -----
  // The identity loop above only finds agents that have their own Entra
  // Agent ID service principal. Azure AI Foundry's "connected agent" /
  // orchestrator pattern commonly does NOT provision a separate identity for
  // an agent that is only invoked as a tool by another agent — such
  // sub-agents would otherwise never appear anywhere in this scanner's
  // output. This phase lists every project's /agents collection directly,
  // adds an entry for any agent not already covered above, and links
  // orchestrator <-> sub-agent relationships from each agent's
  // "connected agent" tool references.
  if (armToken && dataToken) {
    const rawAgentsByKey = new Map(); // key -> { agent, accountName, projectName }
    for (const account of accounts || []) {
      let projects = [];
      try {
        projects = await listProjects(account);
      } catch (err) {
        discoveryErrors.push({
          collector: "azure-scanner-v2",
          discoveryType: "foundry-project-list",
          discoveryStatus: "error",
          error: sanitize(err),
          accountName: account?.name,
        });
        continue;
      }
      for (const project of projects || []) {
        const endpoints = projectEndpoints(project);
        const projectName = projectLeafName(project) || project?.name;
        for (const endpoint of endpoints) {
          const listed = await readFoundryAgents(
            dataToken,
            endpoint,
            (token, url) => request(token, url),
          );
          if (!listed.ok) {
            if (listed.status && listed.status !== 404) {
              discoveryErrors.push({
                collector: "azure-scanner-v2",
                discoveryType: "foundry-project-agents",
                discoveryStatus:
                  listed.status === 401 || listed.status === 403
                    ? "permission_denied"
                    : "error",
                error:
                  listed.error ||
                  explainStatus(listed.status, listed.error) ||
                  "Foundry read failed",
                accountName: account?.name,
                projectName,
              });
            }
            continue;
          }
          for (const rawAgent of listed.agents || []) {
            const key = foundryAgentKey(rawAgent);
            if (!key || rawAgentsByKey.has(key)) continue;
            rawAgentsByKey.set(key, {
              agent: rawAgent,
              account,
              accountName: account?.name,
              projectName,
            });
          }
          break; // first endpoint that answers for this project is enough
        }
      }
    }

    // Orchestrator -> sub-agent links, derived from each agent's own tool defs.
    const subAgentKeysByKey = new Map();
    for (const [key, entry] of rawAgentsByKey) {
      const refs = extractConnectedAgentRefs(entry.agent)
        .map((ref) => resolveAgentKeyByRef(ref, rawAgentsByKey))
        .filter(Boolean);
      if (refs.length) subAgentKeysByKey.set(key, [...new Set(refs)]);
    }
    // Invert: sub-agent -> orchestrator(s) that call it.
    const calledByKeysByKey = new Map();
    for (const [parentKey, childKeys] of subAgentKeysByKey) {
      for (const childKey of childKeys) {
        if (!calledByKeysByKey.has(childKey)) calledByKeysByKey.set(childKey, []);
        calledByKeysByKey.get(childKey).push(parentKey);
      }
    }
    const nameOfKey = (key) => {
      const entry = rawAgentsByKey.get(key);
      return entry ? agentNameOf(entry.agent) || key : key;
    };
    const refList = (keys) =>
      (keys || []).map((k) => ({ agentId: k, name: nameOfKey(k) }));

    // Already-covered agents (found an Entra identity in phase 1) — annotate
    // them with sub-agent / called-by relationships instead of re-emitting.
    const identityLinkedKeys = new Set(
      observations
        .map((o) => o?.metadata?.foundryAgentId)
        .filter(Boolean),
    );
    for (const obs of observations) {
      const key = obs?.metadata?.foundryAgentId;
      if (!key) continue;
      const subAgents = refList(subAgentKeysByKey.get(key));
      const calledByAgents = refList(calledByKeysByKey.get(key));
      if (subAgents.length) obs.metadata.subAgents = subAgents;
      if (calledByAgents.length) {
        obs.metadata.calledByAgents = calledByAgents;
        obs.metadata.isSubAgent = true;
      }
    }

    // Everything else found only by listing the project directly — most
    // commonly connected-agent sub-agents with no Entra identity of their own.
    for (const [key, entry] of rawAgentsByKey) {
      if (identityLinkedKeys.has(key)) continue;
      const name = agentNameOf(entry.agent) || key;
      const hostedInfo = foundryAgentHostedInfo(entry.agent);
      const hostedRuntime = hostedInfo.containerAppResourceId
        ? await resolveHostedRuntime(armToken, hostedInfo.containerAppResourceId, {
            accountDeployments: await getAccountDeployments(entry.account),
            getContainerAppFn,
          })
        : null;
      // Same priority as the identity loop above: the agent definition's own
      // model first, then a declared, resolved model from the hosted
      // container's own env vars.
      const model =
        modelFromAgent(entry.agent) ||
        hostedRuntime?.models?.find(
          (m) => m.discoveryStatus === "declared" && m.modelName,
        )?.modelName ||
        null;
      observations.push(
        foundryOnlyAgentObservation({
          conn,
          tenantId,
          accountName: entry.accountName,
          projectName: entry.projectName,
          agentId: key,
          name,
          model,
          subAgents: refList(subAgentKeysByKey.get(key)),
          calledByAgents: refList(calledByKeysByKey.get(key)),
          agentKind: hostedInfo.kind,
          hostedRuntime,
        }),
      );
    }
  }

  // Container Apps already confirmed as a hosted Foundry agent's own runtime
  // (via definition.container_app_resource_id, resolved above) — used below
  // to stop the ARM sweep's independent name/env-var heuristic from adding a
  // second, lower-confidence "candidate" entry for the same container.
  const hostedContainerAppIds = new Set(
    observations
      .map((o) => o?.metadata?.hostedRuntime?.containerAppResourceId)
      .filter(Boolean)
      .map((id) => String(id).toLowerCase()),
  );

  // --- Supplementary collectors: resource/agent categories the Entra +
  // Foundry-tag correlation above structurally cannot see. Run alongside,
  // never instead of, the core logic above (see file header). ---
  const supplementalJobs = [
    ["armSweep", () => discoverAzureConnector(conn)],
    ["powerPlatform", () => discoverPowerPlatformAgents(conn)],
    ["teamsCatalog", () => discoverTeamsAgentApps(conn, { graphToken })],
    [
      "agent365Catalog",
      () => discoverAgent365CatalogForAzure(conn, { graphToken }),
    ],
  ];
  const supplementalResults = await Promise.allSettled(
    supplementalJobs.map(([, run]) => run()),
  );
  const statsByCollector = {};
  supplementalResults.forEach((result, i) => {
    const label = supplementalJobs[i][0];
    if (result.status === "fulfilled") {
      const value = result.value || {};
      let extraObservations = value.observations || [];
      if (label === "armSweep") {
        // The ARM sweep inventories every AI-relevant resource it finds
        // (Cognitive Search, ML workspace shells, alert rules, the raw
        // Cognitive Services/Foundry account, etc.) as well as actual agent
        // detections. Only the latter belong in the agent inventory here:
        //   - inventoryClass !== "ai_cloud_agent" -> a resource, not an
        //     agent (no agent was detected running on/behind it) — drop it.
        //   - discoveryMode === "azure-agent-api" -> the ARM sweep's own
        //     Foundry-agent detection, which duplicates what the Entra
        //     Agent ID + Foundry-tag correlation above already produces
        //     with better (identity-linked) data — drop it too.
        // What remains: confirmed Bot Service agents and heuristic
        // candidate agents on Container Apps / Web Apps / VMs — except a
        // Container App we already confirmed is a specific hosted Foundry
        // agent's runtime above (better data, would otherwise duplicate).
        extraObservations = extraObservations.filter((o) =>
          isArmSweepAgentKept(o, hostedContainerAppIds),
        );
      }
      observations.push(...extraObservations);
      discoveryErrors.push(
        ...(value.discoveryErrors || []).map((e) => ({
          ...e,
          collector: label,
        })),
      );
      statsByCollector[label] = value.stats || {};
    } else {
      discoveryErrors.push({
        collector: label,
        discoveryType: `${label}-collector`,
        discoveryStatus: "error",
        error: sanitize(result.reason),
      });
      statsByCollector[label] = { failed: true };
    }
  });

  const denied = discoveryErrors.some(
    (item) => item.discoveryStatus === "permission_denied",
  );
  const agentsDiscovered = observations.filter(
    (o) =>
      o?.metadata?.agentStatus === "confirmed" ||
      o?.metadata?.agentStatus === "candidate",
  ).length;

  return {
    observations,
    discoveryErrors,
    stats: {
      scanner: "azure-scanner-v2",
      legacyScannerDisabled: true,
      agentsDiscovered,
      cloudResourcesIngested: observations.length,
      discoveryErrors: discoveryErrors.length,
      warning: denied
        ? "A 403 means the credential is missing Microsoft.CognitiveServices/accounts/AIServices/agents/read. Azure AI Developer in this catalog does not include that data action. Entra identities need AgentIdentity.Read.All."
        : null,
      supplementalCollectors: {
        armResourcesIngested:
          statsByCollector.armSweep?.cloudResourcesIngested ??
          statsByCollector.armSweep?.aiRelevantResources ??
          0,
        copilotStudioAgents: statsByCollector.powerPlatform?.agentsFound || 0,
        powerPlatformEnvironments:
          statsByCollector.powerPlatform?.environmentsScanned || 0,
        teamsAppsFlagged: statsByCollector.teamsCatalog?.agentsFlagged || 0,
        agent365CatalogAgents:
          statsByCollector.agent365Catalog?.agent365CatalogAgents || 0,
      },
      statsByCollector,
    },
  };
}

/**
 * Backward-compatibility re-exports — validateAzureConnector,
 * discoverAzureEcosystem (now unused by the live path), discoverAzureConnector
 * (ARM-only), etc. still resolve for any caller importing this module.
 */
export * from "./azure.deepscanner";
