// @ts-nocheck
/**
 * evidence.normalizer.ts
 *
 * Converts a DiscoveredAgent row (with its metadata.adversarial_surface,
 * metadata.deep, and top-level fields) into the normalized SecurityDomains
 * structure required by the OWASP rule engine.
 *
 * Critical design rules:
 *  - tools = [] does NOT mean "no tools" when definition plane was not scanned
 *  - internet_access = false does NOT mean no egress (field may not be collected)
 *  - over_permissioned is only set when positive evidence exists
 *  - PHI/PII is never inferred from agent name alone
 *  - All sources and timestamps are preserved
 */

import type {
  SecurityDomains,
  EvidenceFact,
  EvidenceItem,
  EvidenceStatus,
  IdentityDomain,
  ModelDomain,
  InstructionsDomain,
  ToolEvidence,
  ToolItem,
  PermissionsDomain,
  DataAccessDomain,
  NetworkDomain,
  MemoryDomain,
  GuardrailsDomain,
  HumanOversightDomain,
  InterAgentDomain,
  SupplyChainDomain,
  RuntimeDomain,
  McpServerRef,
  MemoryStoreRef,
} from "./evidence.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function fact(
  text: string,
  source: string,
  method: EvidenceFact["collection_method"] = "api",
  collectedAt?: string | null,
): EvidenceFact {
  return { fact: text, source, collection_method: method, collected_at: collectedAt ?? null };
}

function unknownItem<T = unknown>(limitations: string[] = []): EvidenceItem<T> {
  return {
    value: null,
    status: "unknown",
    source: null,
    confidence: 0,
    evidence: [],
    limitations,
  };
}

function observedItem<T>(
  value: T,
  source: string,
  confidence: number,
  facts: EvidenceFact[],
  method: EvidenceFact["collection_method"] = "api",
): EvidenceItem<T> {
  return {
    value,
    status: "observed",
    source,
    collection_method: method,
    collected_at: nowIso(),
    confidence,
    evidence: facts,
    limitations: [],
  };
}

function notCollectedItem<T = unknown>(note: string): EvidenceItem<T> {
  return {
    value: null,
    status: "not_collected",
    source: null,
    confidence: 0,
    evidence: [],
    limitations: [note],
  };
}

/** Determine the primary source collector name from metadata */
function primarySource(meta: Record<string, unknown>): string {
  const mode = strOrNull(meta.discoveryMode) ?? "";
  if (mode.includes("entra")) return "microsoft_graph";
  if (mode.includes("power-platform")) return "power_platform";
  if (mode.includes("bedrock")) return "aws_bedrock";
  if (mode.includes("teams")) return "microsoft_teams";
  if (mode.includes("agent365")) return "agent_365";
  const provider = strOrNull(meta.platform as string) ?? strOrNull(meta.cloudProvider as string) ?? "";
  if (provider === "azure") return "azure_arm";
  if (provider === "aws") return "aws_api";
  if (provider === "gcp") return "gcp_api";
  return "unknown";
}

// ─── Definition Plane Limitation Detection ────────────────────────────────────

function getPlaneHint(meta: Record<string, unknown>, plane: "identity_plane" | "definition_plane" | "permission_plane" | "runtime_plane"): string {
  const hints = asObj(meta.security_collection_hints);
  return strOrNull(hints[plane] as string) || "not_accessed";
}

/**
 * Returns true when we know the tool/instructions/memory information lives
 * on a definition plane the current collector could not access.
 */
function isDefinitionPlaneUnavailable(meta: Record<string, unknown>): boolean {
  const hint = getPlaneHint(meta, "definition_plane");
  if (hint === "not_accessed" || hint === "permission_denied" || hint === "error") {
    return true;
  }
  
  // Legacy fallback
  const limitations = asArr<string>(
    asObj(meta.deep).limitations ?? asObj(meta).limitations,
  );
  const hasLimitation = limitations.some(
    (l) =>
      /copilot.?studio|agent.?365|definition.?plane|agent identity.*tools|tools.*definition/i.test(l),
  );
  const provider = strOrNull(meta.discoveryMode as string) ?? "";
  return (
    hasLimitation ||
    provider.includes("entra-agent-id") ||
    (strOrNull(meta.inventoryClass as string) === "ai_cloud_agent" && provider.includes("entra"))
  );
}

// ─── Domain Builders ──────────────────────────────────────────────────────────

function buildIdentityDomain(agent: any): IdentityDomain {
  const meta = asObj(agent.metadata);
  const src = primarySource(meta);
  const deepScanAvail = src === "microsoft_graph" || src === "azure_arm" || meta.objectId;

  const objectId = strOrNull(meta.objectId as string);
  const appId = strOrNull(meta.appId as string);
  const tenantId = strOrNull(meta.tenantId as string);
  const spType = strOrNull(meta.servicePrincipalType as string);
  const createdAt = strOrNull(meta.createdDateTime as string);
  const owner = strOrNull(agent.owner);
  const ownerOrg = strOrNull(meta.appOwnerOrganizationId as string);
  const agentId = strOrNull(agent.id);
  const principalId = strOrNull(meta.principalId as string) ?? objectId;
  const accountEnabled = meta.accountEnabled !== undefined ? boolOrNull(meta.accountEnabled) : null;
  const lifecycleStatus = accountEnabled === true
    ? "active"
    : accountEnabled === false
    ? "disabled"
    : null;

  const colStatus: EvidenceStatus = objectId || appId || tenantId ? "observed" : "unknown";

  const itemOrUnk = <T>(val: T | null, label: string): EvidenceItem<T> => {
    if (val === null) {
      return unknownItem<T>([`${label} not collected from ${src}`]);
    }
    return observedItem(val, src, 0.95, [fact(`${label}=${val}`, src)]);
  };

  return {
    collection_status: colStatus,
    agent_id: itemOrUnk(agentId, "agentId"),
    object_id: itemOrUnk(objectId, "objectId"),
    app_id: itemOrUnk(appId, "appId"),
    tenant_id: itemOrUnk(tenantId, "tenantId"),
    service_principal_type: itemOrUnk(spType, "servicePrincipalType"),
    principal_id: itemOrUnk(principalId, "principalId"),
    owner: itemOrUnk(owner, "owner"),
    owner_organization: itemOrUnk(ownerOrg, "appOwnerOrganizationId"),
    lifecycle_status: itemOrUnk(lifecycleStatus, "lifecycleStatus"),
    created_at: itemOrUnk(createdAt, "createdDateTime"),
    modified_at: unknownItem(["Modification date not collected from identity plane"]),
    identity_type: itemOrUnk(spType ?? (deepScanAvail ? "ServiceIdentity" : null), "identityType"),
    account_enabled: {
      value: accountEnabled,
      status: accountEnabled !== null ? "observed" : "unknown",
      source: src,
      confidence: accountEnabled !== null ? 0.95 : 0,
      evidence: accountEnabled !== null ? [fact(`accountEnabled=${accountEnabled}`, src)] : [],
      limitations: accountEnabled === null ? ["accountEnabled not returned by collector"] : [],
    },
  };
}

function buildModelDomain(agent: any): ModelDomain {
  const meta = asObj(agent.metadata);
  const deep = asObj(meta.deep);
  const src = primarySource(meta);
  const rawModel = strOrNull(agent.model);
  const foundationModel =
    strOrNull(deep.foundationModel as string) ??
    strOrNull(meta.foundationModel as string) ??
    null;

  // "microsoft-agent-identity" is an identity label, not the real LLM
  const isPlaceholder =
    rawModel === "microsoft-agent-identity" ||
    rawModel === "copilot-studio-agent" ||
    rawModel === "entra-agent-identity";

  const limitations: string[] = [];
  if (isPlaceholder) {
    limitations.push(
      `Model field "${rawModel}" is an identity-plane label, not the actual underlying LLM.`,
      "Actual foundation model resides on the definition plane (Copilot Studio / Agent 365).",
    );
  }

  const colStatus: EvidenceStatus = foundationModel
    ? "observed"
    : isPlaceholder
    ? "not_collected"
    : rawModel
    ? "observed"
    : "unknown";

  return {
    collection_status: colStatus,
    name: {
      value: rawModel,
      status: rawModel ? "observed" : "unknown",
      source: src,
      confidence: isPlaceholder ? 0.1 : 0.8,
      evidence: rawModel ? [fact(`model=${rawModel}`, src)] : [],
      limitations: isPlaceholder ? limitations : [],
    },
    provider: {
      value: strOrNull(agent.provider),
      status: agent.provider ? "observed" : "unknown",
      source: src,
      confidence: 0.7,
      evidence: agent.provider ? [fact(`provider=${agent.provider}`, src)] : [],
      limitations: [],
    },
    version: {
      value: strOrNull(deep.agentVersion as string) ?? null,
      status: "unknown",
      source: src,
      confidence: 0,
      evidence: [],
      limitations: ["Model version not collected from identity plane"],
    },
    foundation_model: {
      value: foundationModel,
      status: foundationModel ? "observed" : "unknown",
      source: src,
      confidence: foundationModel ? 0.85 : 0,
      evidence: foundationModel ? [fact(`foundationModel=${foundationModel}`, src)] : [],
      limitations: isPlaceholder
        ? ["Foundation model not determinable from Entra Agent ID plane"]
        : [],
    },
    endpoint: {
      value: strOrNull(agent.endpoint),
      status: agent.endpoint ? "observed" : "not_collected",
      source: src,
      confidence: agent.endpoint ? 0.8 : 0,
      evidence: agent.endpoint ? [fact(`endpoint=${agent.endpoint}`, src)] : [],
      limitations: [],
    },
    verified: Boolean(foundationModel && !isPlaceholder),
    is_identity_placeholder: isPlaceholder,
    confidence: isPlaceholder ? 0.15 : foundationModel ? 0.85 : 0.5,
    evidence: rawModel ? [fact(`model=${rawModel}`, src)] : [],
    limitations,
  };
}

function buildInstructionsDomain(agent: any): InstructionsDomain {
  const meta = asObj(agent.metadata);
  const deep = asObj(meta.deep);
  const src = primarySource(meta);
  const deepInstructions = asObj(deep.instructions);
  const hasInstructions = Boolean(meta.hasInstructions ?? deepInstructions.present);
  const definitionPlaneUnavailable = isDefinitionPlaneUnavailable(meta);
  const deepScanned = Boolean(meta.deepScan || deep.deepScan);

  if (definitionPlaneUnavailable && !hasInstructions) {
    return {
      collection_status: "unknown",
      present: null,
      hash: null,
      length: null,
      source: null,
      last_modified: null,
      contains_safety_rules: null,
      contains_tool_guidance: null,
      contains_data_handling_rules: null,
      contains_identity_constraints: null,
      contains_output_constraints: null,
      contains_external_data_instructions: null,
      unavailable_reason: "definition_plane_unavailable",
      confidence: 0.95,
      evidence: [fact("Agent identity confirmed; definition plane not accessible", src)],
      limitations: [
        "Agent definition (instructions, tools, policies) lives on Copilot Studio / Agent 365 definition plane.",
        "Entra Agent ID collector only accesses the identity plane.",
        "Run Copilot Studio or Agent 365 deep scan to collect instructions.",
      ],
    };
  }

  if (!hasInstructions) {
    return {
      collection_status: deepScanned ? "not_observed" : "unknown",
      present: deepScanned ? false : null,
      hash: null,
      length: null,
      source: null,
      last_modified: null,
      contains_safety_rules: null,
      contains_tool_guidance: null,
      contains_data_handling_rules: null,
      contains_identity_constraints: null,
      contains_output_constraints: null,
      contains_external_data_instructions: null,
      unavailable_reason: deepScanned ? null : "not_collected",
      confidence: deepScanned ? 0.7 : 0.3,
      evidence: deepScanned
        ? [fact("Deep scan ran; no instruction text returned", src)]
        : [fact("Instruction collection not attempted", src)],
      limitations: deepScanned
        ? ["API returned no instructions; may indicate system prompt is not accessible via this API version"]
        : [],
    };
  }

  // Instructions were collected
  return {
    collection_status: "observed",
    present: true,
    hash: strOrNull(deepInstructions.hash as string) ?? strOrNull(meta.instructionsHash as string),
    length:
      (deepInstructions.length as number | null) ?? (meta.instructionLength as number | null) ?? null,
    source:
      strOrNull(deepInstructions.source as string) ??
      strOrNull(meta.instructionSource as string) ??
      src,
    last_modified: strOrNull(meta.instructionLastModified as string),
    contains_safety_rules: boolOrNull(deepInstructions.contains_safety_rules),
    contains_tool_guidance: boolOrNull(deepInstructions.contains_tool_guidance),
    contains_data_handling_rules:
      boolOrNull(deepInstructions.contains_data_handling_rules) ?? null,
    contains_identity_constraints: null,
    contains_output_constraints: null,
    contains_external_data_instructions: null,
    unavailable_reason: null,
    confidence: 0.85,
    evidence: [
      fact(
        `Instructions hash=${strOrNull(deepInstructions.hash as string) ?? "unknown"}, length=${deepInstructions.length ?? "?"}`,
        strOrNull(deepInstructions.source as string) ?? src,
      ),
    ],
    limitations: ["Full instruction text not stored (hash + preview only)"],
  };
}

function buildToolsDomain(agent: any): ToolEvidence {
  const meta = asObj(agent.metadata);
  const deep = asObj(meta.deep);
  const surface = asObj(meta.adversarial_surface);
  const src = primarySource(meta);

  const definitionPlaneUnavailable = isDefinitionPlaneUnavailable(meta);
  const deepScanned = Boolean(meta.deepScan || deep.deepScan || meta.deepScanStatus === "ok");
  const deepLimitations = asArr<string>(deep.limitations);

  // Collect tools from multiple sources
  const surfaceTools = asArr(surface.tools) as any[];
  const deepTools = asArr(deep.tools) as any[];
  const agentTools = asArr(agent.tools) as any[];
  const allTools = surfaceTools.length
    ? surfaceTools
    : deepTools.length
    ? deepTools
    : agentTools;

  let collectionStatus: EvidenceStatus;
  let unavailableReason: string | null = null;
  let limitations: string[] = [...deepLimitations];

  const definitionPlaneHint = getPlaneHint(meta, "definition_plane");

  if (allTools.length > 0) {
    collectionStatus = "observed";
  } else if (definitionPlaneUnavailable) {
    // tools = [] but definition plane was NOT accessible
    if (definitionPlaneHint === "permission_denied") {
      collectionStatus = "permission_denied";
      unavailableReason = "permission_denied";
      limitations = ["Tools could not be scanned due to permission denial.", ...limitations];
    } else if (definitionPlaneHint === "error") {
      collectionStatus = "error";
      unavailableReason = "api_error";
      limitations = ["Tools could not be scanned due to an API error.", ...limitations];
    } else {
      collectionStatus = "not_collected";
      unavailableReason = "definition_plane_unavailable";
      limitations = [
        "Tools exist on Copilot Studio / Agent 365 definition plane.",
        "Entra Agent ID collector only discovers the identity; tools require Copilot Studio API access.",
        "Empty tools[] does NOT confirm zero tools exist.",
        ...limitations,
      ];
    }
  } else if (deepScanned) {
    collectionStatus = "not_observed"; // scanned and found none
  } else {
    collectionStatus = "unknown";
    limitations = [
      "Tools not collected — definition plane scan not performed.",
      ...limitations,
    ];
  }

  const items: ToolItem[] = allTools.map((t: any) => ({
    id: strOrNull(t.id),
    name: strOrNull(t.name),
    description: strOrNull(t.description),
    type: strOrNull(t.type ?? t.source),
    source: strOrNull(t.source) ?? src,
    operations: [],
    permissions: asArr<string>(t.permissions),
    risk_flags: {
      can_execute_code: Boolean(t.risk_flags?.can_execute_code),
      can_access_pii: Boolean(t.risk_flags?.can_access_pii),
      can_access_phi: Boolean(t.risk_flags?.can_access_phi),
      can_modify_state: Boolean(t.risk_flags?.can_modify_state),
      can_call_external_apis: Boolean(t.risk_flags?.can_call_external_apis),
      can_access_filesystem: Boolean(t.risk_flags?.can_access_filesystem),
      can_access_secrets: Boolean(t.risk_flags?.can_access_secrets),
    },
    requires_human_approval: boolOrNull(t.requires_human_approval),
    internet_exposed: boolOrNull(t.internet_exposed),
    data_classes: asArr<string>(t.data_classes),
    confidence: t.confidence ?? "low",
    evidence: asArr<EvidenceFact>(t.evidence).length
      ? asArr<EvidenceFact>(t.evidence)
      : [fact(`Tool "${t.name}" from ${src}`, src)],
  }));

  return {
    collection_status: collectionStatus,
    collection_unavailable_reason: unavailableReason,
    source: collectionStatus === "success" ? src : null,
    items,
    limitations,
  };
}

function buildPermissionsDomain(agent: any): PermissionsDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const iam = asObj(surface.identity_and_access);
  const src = primarySource(meta);

  const declaredPermissions = asArr<string>(agent.permissions ?? iam.permissions ?? []);
  const overPermissioned = iam.over_permissioned !== null && iam.over_permissioned !== undefined
    ? boolOrNull(iam.over_permissioned)
    : null;
  const credentialRisk = strOrNull(iam.credential_exposure_risk as string) as
    | "unknown"
    | "low"
    | "medium"
    | "high"
    | null ?? "unknown";

  // We only claim over_permissioned when there is positive evidence
  const permColStatus: EvidenceStatus = declaredPermissions.length
    ? "observed"
    : "not_collected";

  const noErbacEvidence = ["Effective RBAC assignments not collected", "Role assignments not expanded from identity plane"];
  const noAppPermEvidence = ["Application permissions not queried from Entra app registration"];

  return {
    collection_status: permColStatus,
    declared_permissions: declaredPermissions,
    application_permissions: notCollectedItem<string[]>(noAppPermEvidence[0]),
    delegated_permissions: notCollectedItem<string[]>("Delegated permissions not collected"),
    rbac_roles: notCollectedItem<string[]>(noErbacEvidence[0]),
    managed_identity_permissions: notCollectedItem<string[]>("Managed identity permissions not collected"),
    over_permissioned: overPermissioned, // only set when evidence supports
    privileged: null, // cannot determine without RBAC
    write_capable: declaredPermissions.some((p) => /write|create|update|put|post|patch/i.test(p))
      ? true
      : null,
    delete_capable: declaredPermissions.some((p) => /delete|remove/i.test(p)) ? true : null,
    admin_capable: declaredPermissions.some((p) => /admin|owner|contributor/i.test(p)) ? true : null,
    cross_tenant: null,
    credential_exposure_risk: credentialRisk,
    confidence: declaredPermissions.length ? 0.4 : 0.1,
    evidence: declaredPermissions.length
      ? [fact(`${declaredPermissions.length} declared permissions`, src)]
      : [fact("No permission evidence collected from identity plane", src)],
    limitations: [
      "Effective permissions not collected — only declared permissions visible",
      "RBAC role assignments require additional Graph/ARM API call",
      "Privilege escalation paths not assessed",
    ],
  };
}

function buildDataAccessDomain(agent: any): DataAccessDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const dataAccess = asObj(surface.data_access);
  const src = primarySource(meta);

  const hasPii = boolOrNull(dataAccess.has_pii);
  const hasPhi = boolOrNull(dataAccess.has_phi);
  const dataClasses = asArr<string>(dataAccess.data_classes ?? []);

  const boolFact = (field: string, value: boolean | null): EvidenceItem<boolean> => {
    if (value === null) {
      return unknownItem<boolean>([`${field} not collected`]);
    }
    return observedItem(value, src, 0.8, [fact(`${field}=${value}`, src)]);
  };

  // Map top-level boolean flags
  const dbAccess = boolOrNull(agent.database_access);
  const emailAccess = boolOrNull(agent.email_access);
  const calendarAccess = boolOrNull(agent.calendar_access);
  const githubAccess = boolOrNull(agent.github_access);
  const slackAccess = boolOrNull(agent.slack_access);
  const filesystemAccess = boolOrNull(agent.filesystem_access);

  return {
    collection_status: "observed",
    data_sources: asArr(dataAccess.data_stores ?? []).map((ds: any) => ({
      name: strOrNull(ds.name),
      type: strOrNull(ds.type),
      classification: strOrNull(ds.sensitivity),
      access: asArr<string>(ds.access_level ? [ds.access_level] : []),
      external_transfer_allowed: null,
      evidence: asArr<EvidenceFact>(ds.evidence ?? []).length
        ? asArr<EvidenceFact>(ds.evidence)
        : [fact(`Data store ${ds.name ?? "unknown"}`, src)],
    })),
    has_pii: hasPii,
    has_phi: hasPhi,
    data_classes: dataClasses,
    database_access: boolFact("database_access", dbAccess),
    email_access: boolFact("email_access", emailAccess),
    calendar_access: boolFact("calendar_access", calendarAccess),
    github_access: boolFact("github_access", githubAccess),
    slack_access: boolFact("slack_access", slackAccess),
    filesystem_access: boolFact("filesystem_access", filesystemAccess),
    external_transfer_assessed: false,
    confidence: hasPii !== null || hasPhi !== null ? 0.6 : 0.3,
    evidence: [
      fact(
        `PII=${hasPii ?? "unknown"}, PHI=${hasPhi ?? "unknown"}, data_classes=[${dataClasses.join(",")}]`,
        src,
      ),
    ],
    limitations: [
      "PII/PHI is never inferred from agent name alone — requires content or tool evidence",
      "Data classification only from tool risk_flags and explicit KB metadata",
    ],
  };
}

function buildNetworkDomain(agent: any): NetworkDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const connectivity = asObj(surface.connectivity);
  const src = primarySource(meta);

  // internet_access is a top-level boolean flag from scanner
  const internetAccess = boolOrNull(agent.internet_access ?? connectivity.internet_access);
  const browserAccess = boolOrNull(agent.browser_access ?? connectivity.browser_access);

  const netFact = (field: string, value: boolean | null): EvidenceItem<boolean> => {
    if (value === null) {
      return unknownItem<boolean>([`${field} not determined from discovery`]);
    }
    return {
      value,
      status: value ? "observed" : "not_observed",
      source: src,
      collection_method: "config",
      collected_at: nowIso(),
      confidence: 0.75,
      evidence: [fact(`${field}=${value}`, src)],
      limitations:
        value === false
          ? [
              `${field}=false does not guarantee no egress — network policy may not have been fully assessed`,
            ]
          : [],
    };
  };

  return {
    collection_status: internetAccess !== null ? "observed" : "unknown",
    internet_access: netFact("internet_access", internetAccess),
    inbound_access: unknownItem<boolean>(["Inbound access policy not collected"]),
    outbound_access: netFact("outbound_access", internetAccess),
    public_endpoint: {
      value: strOrNull(agent.endpoint),
      status: agent.endpoint ? "observed" : "unknown",
      source: src,
      confidence: 0.8,
      evidence: agent.endpoint ? [fact(`endpoint=${agent.endpoint}`, src)] : [],
      limitations: [],
    },
    private_endpoint: unknownItem<string>(["Private endpoint not assessed"]),
    unrestricted_egress: internetAccess === true ? null : null, // cannot conclude even if true
    browser_access: netFact("browser_access", browserAccess),
    allowed_domains: [],
    known_external_destinations: [],
    confidence: internetAccess !== null ? 0.7 : 0.2,
    evidence: [
      fact(
        `internet_access=${internetAccess ?? "unknown"}, browser_access=${browserAccess ?? "unknown"}`,
        src,
      ),
    ],
    limitations: [
      "internet_access=true means egress exists; it does NOT confirm unrestricted egress without network policy analysis",
      "Allowed domains, DNS restrictions, and proxies not collected",
    ],
  };
}

function buildMemoryDomain(agent: any): MemoryDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const memCtx = asObj(surface.memory_and_context);
  const deep = asObj(meta.deep);
  const src = primarySource(meta);
  const definitionPlaneUnavailable = isDefinitionPlaneUnavailable(meta);

  const hasMemory = boolOrNull(memCtx.has_memory);
  const memoryType = strOrNull(memCtx.memory_type as string) ?? strOrNull(agent.memory_store);
  const rawVectorDb = strOrNull(agent.vector_database);

  const kbs: MemoryStoreRef[] = asArr(memCtx.knowledge_bases ?? []).map((kb: any) => ({
    id: strOrNull(kb.id ?? kb.knowledgeBaseId),
    name: strOrNull(kb.name ?? kb.knowledgeBaseId),
    type: strOrNull(kb.type) ?? "knowledge_base",
    sensitivity: strOrNull(kb.sensitivity) ?? "unknown",
    access_level: strOrNull(kb.access_level ?? kb.state) ?? "unknown",
    evidence: asArr<EvidenceFact>(kb.evidence ?? []).length
      ? asArr<EvidenceFact>(kb.evidence)
      : [fact(`Knowledge base ${kb.name ?? kb.id ?? "unknown"}`, src)],
  }));

  const vectors: MemoryStoreRef[] = [
    ...asArr(memCtx.vector_stores ?? []).map((vs: any) => ({
      id: null,
      name: strOrNull(vs.name),
      type: strOrNull(vs.type) ?? "vector_store",
      sensitivity: strOrNull(vs.sensitivity) ?? "unknown",
      access_level: strOrNull(vs.access_level) ?? "unknown",
      evidence: [fact(`Vector store ${vs.name ?? "unknown"}`, src)],
    })),
    ...(rawVectorDb
      ? [
          {
            id: null,
            name: rawVectorDb,
            type: "vector_database",
            sensitivity: "unknown",
            access_level: "unknown",
            evidence: [fact(`vector_database=${rawVectorDb}`, src)],
          },
        ]
      : []),
  ];

  const colStatus: EvidenceStatus =
    hasMemory !== null
      ? "observed"
      : definitionPlaneUnavailable
      ? "unknown"
      : "not_collected";

  return {
    collection_status: colStatus,
    has_memory: hasMemory,
    memory_type: memoryType,
    persistent_memory: {
      value: hasMemory,
      status: hasMemory !== null ? "observed" : "unknown",
      source: src,
      confidence: hasMemory !== null ? 0.7 : 0,
      evidence: hasMemory !== null ? [fact(`has_memory=${hasMemory}`, src)] : [],
      limitations:
        definitionPlaneUnavailable
          ? ["Memory configuration exists on definition plane; null does not confirm no memory"]
          : [],
    },
    vector_stores: vectors,
    knowledge_bases: kbs,
    write_capability: unknownItem<boolean>(["Memory write capability not assessed"]),
    delete_capability: unknownItem<boolean>(["Memory delete capability not assessed"]),
    rag_configured: kbs.length > 0 || vectors.length > 0 ? true : hasMemory ? null : null,
    confidence: hasMemory !== null ? 0.65 : 0.1,
    evidence: [
      fact(
        `has_memory=${hasMemory ?? "unknown"}, kbs=${kbs.length}, vectors=${vectors.length}`,
        src,
      ),
    ],
    limitations: definitionPlaneUnavailable
      ? [
          "vector_database=null does NOT confirm no vector store when definition plane was not scanned",
          "Memory configuration requires Copilot Studio / Bedrock definition plane scan",
        ]
      : [],
  };
}

function buildGuardrailsDomain(agent: any): GuardrailsDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const obs = asObj(surface.observability);
  const deep = asObj(meta.deep);
  const deepGuardrails = asObj(deep.guardrails);
  const src = primarySource(meta);
  const definitionPlaneUnavailable = isDefinitionPlaneUnavailable(meta);

  const guardrailsDetected = boolOrNull(obs.guardrails_detected);
  const guardrailId =
    strOrNull(obs.guardrail_id as string) ??
    strOrNull(deepGuardrails.guardrailId as string) ??
    strOrNull(deep.guardrailId as string);

  const colStatus: EvidenceStatus =
    guardrailsDetected !== null
      ? "observed"
      : definitionPlaneUnavailable
      ? "unknown"
      : deep.deepScan
      ? "not_observed"
      : "unknown";

  return {
    collection_status: colStatus,
    present: guardrailsDetected,
    guardrail_id: guardrailId,
    prompt_injection_detection: boolOrNull(deepGuardrails.prompt_injection_detection),
    output_filtering: boolOrNull(deepGuardrails.output_filtering ?? obs.outputFiltering),
    pii_detection: boolOrNull(deepGuardrails.pii_detection),
    phi_detection: boolOrNull(deepGuardrails.phi_detection),
    content_filtering: boolOrNull(deepGuardrails.content_filtering),
    tool_policy: boolOrNull(deepGuardrails.tool_policy ?? deepGuardrails.present),
    data_loss_prevention: null,
    rate_limits: null,
    sandboxing: null,
    fail_open: boolOrNull(deepGuardrails.fail_open),
    source: guardrailId ?? (deepGuardrails.source as string | null) ?? null,
    confidence: guardrailsDetected !== null ? 0.75 : 0.1,
    evidence: guardrailsDetected !== null
      ? [fact(`guardrails_detected=${guardrailsDetected}, id=${guardrailId ?? "none"}`, src)]
      : [fact("Guardrail status not available from collector", src)],
    limitations: definitionPlaneUnavailable
      ? [
          "Guardrail/policy configuration exists on the definition plane — not accessible from identity plane",
          "guardrails_detected=null does NOT confirm no guardrails exist",
        ]
      : guardrailsDetected === false
      ? [
          "No guardrail configuration found during deep scan; does not rule out runtime-only guardrails",
        ]
      : [],
  };
}

function buildHumanOversightDomain(agent: any): HumanOversightDomain {
  const meta = asObj(agent.metadata);
  const src = primarySource(meta);
  const definitionPlaneUnavailable = isDefinitionPlaneUnavailable(meta);

  const limitations = definitionPlaneUnavailable
    ? [
        "Human oversight / autonomy configuration lives on the definition plane",
        "Not accessible from Entra Agent ID or ARM identity plane",
        "Requires Copilot Studio or Agent 365 definition plane scan",
      ]
    : ["Human oversight not collected from this provider"];

  return {
    collection_status: "unknown",
    autonomy_level: unknownItem<string>(limitations),
    human_approval_required: unknownItem<boolean>(limitations),
    approval_required_for: [],
    can_execute_without_user: null,
    can_send_external_communications: null,
    can_modify_data: null,
    can_delete_data: null,
    can_create_resources: null,
    can_retry_autonomously: null,
    can_delegate: null,
    max_action_chain: unknownItem<number>(limitations),
    confidence: 0,
    evidence: [fact("Human oversight/autonomy not collected from current discovery plane", src)],
    limitations,
  };
}

function buildInterAgentDomain(agent: any): InterAgentDomain {
  const meta = asObj(agent.metadata);
  const surface = asObj(meta.adversarial_surface);
  const src = primarySource(meta);

  const mcpConnections = asArr(agent.mcp_connections ?? []) as any[];
  const surfaceMcpServers = asArr(surface.mcp_servers ?? []) as any[];
  const allMcp = [...mcpConnections, ...surfaceMcpServers];

  const mcpRefs: McpServerRef[] = allMcp.map((m: any) => ({
    name: strOrNull(m.name),
    endpoint: strOrNull(m.endpoint),
    tools_exposed: asArr<string>(m.tools_exposed ?? []),
    auth_type: strOrNull(m.auth?.type ?? m.authType),
    auth_present: boolOrNull(m.auth?.details_present ?? m.authPresent),
    evidence: [fact(`MCP server ${m.name ?? m.endpoint ?? "unknown"}`, src)],
  }));

  const colStatus: EvidenceStatus = mcpRefs.length > 0 ? "observed" : "not_collected";

  return {
    collection_status: colStatus,
    connected_agents: [],
    delegation_chains: [],
    protocols: mcpRefs.length ? ["mcp"] : [],
    mcp_servers: mcpRefs,
    authentication: unknownItem<string>(["Inter-agent authentication not assessed"]),
    authorization: unknownItem<string>(["Inter-agent authorization not assessed"]),
    trusted_peers: [],
    confidence: mcpRefs.length ? 0.5 : 0.05,
    evidence: mcpRefs.length
      ? [fact(`${mcpRefs.length} MCP server(s) discovered`, src)]
      : [fact("No inter-agent connections found from discovery", src)],
    limitations: [
      "A2A (Agent-to-Agent) protocol connections not assessed",
      "Authentication between agents not validated",
      "MCP server authorization scopes not collected",
    ],
  };
}

function buildSupplyChainDomain(agent: any): SupplyChainDomain {
  const meta = asObj(agent.metadata);
  const src = primarySource(meta);

  const framework = strOrNull(agent.framework);
  const publisher = strOrNull(meta.publisherName as string);
  const blueprintId = strOrNull(meta.agentIdentityBlueprintId as string);

  return {
    collection_status: framework || publisher ? "observed" : "not_collected",
    source_repository: unknownItem<string>(["Source repository not collected"]),
    publisher: publisher
      ? observedItem(publisher, src, 0.85, [fact(`publisherName=${publisher}`, src)])
      : unknownItem<string>(["Publisher not collected"]),
    framework: framework
      ? observedItem(framework, src, 0.9, [fact(`framework=${framework}`, src)])
      : unknownItem<string>(["Framework not determined"]),
    framework_version: unknownItem<string>(["Framework version not collected"]),
    model_provider: {
      value: strOrNull(agent.provider),
      status: agent.provider ? "observed" : "unknown",
      source: src,
      confidence: 0.7,
      evidence: agent.provider ? [fact(`provider=${agent.provider}`, src)] : [],
      limitations: [],
    },
    model_version: unknownItem<string>(["Model version not collected"]),
    mcp_servers: asArr<any>(agent.mcp_connections ?? []).map(
      (m: any) => strOrNull(m.name ?? m.endpoint) ?? "unknown",
    ),
    third_party_tools: [],
    artifact_provenance: blueprintId
      ? observedItem(blueprintId, src, 0.7, [fact(`agentIdentityBlueprintId=${blueprintId}`, src)])
      : unknownItem<string>(["Artifact provenance not collected"]),
    confidence: framework || publisher ? 0.6 : 0.1,
    evidence: [
      fact(
        `framework=${framework ?? "unknown"}, publisher=${publisher ?? "unknown"}`,
        src,
      ),
    ],
    limitations: ["Dependency graph, container image, CI/CD source not collected"],
  };
}

function buildRuntimeDomain(): RuntimeDomain {
  return {
    collection_status: "not_collected",
    tests_run: 0,
    tests_completed: 0,
    last_test_at: null,
    evidence: [
      {
        fact: "Runtime security test framework not yet activated",
        source: "system",
        collection_method: "config",
        collected_at: nowIso(),
      },
    ],
  };
}

// ─── Main Normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize a DiscoveredAgent into the SecurityDomains structure
 * consumed by the OWASP rule engine.
 *
 * This is the ONLY entry point — do not call domain builders directly.
 */
export function normalizeSecurityDomains(agent: any): {
  domains: SecurityDomains;
  evidence_sources: string[];
} {
  const meta = asObj(agent.metadata);
  const src = primarySource(meta);

  // Collect all evidence source identifiers
  const sources = new Set<string>([src]);
  if (meta.connectorName) sources.add(String(meta.connectorName));
  if (meta.deepScan) sources.add(String(meta.deepScan));

  const domains: SecurityDomains = {
    identity: buildIdentityDomain(agent),
    model: buildModelDomain(agent),
    instructions: buildInstructionsDomain(agent),
    tools: buildToolsDomain(agent),
    permissions: buildPermissionsDomain(agent),
    data_access: buildDataAccessDomain(agent),
    network: buildNetworkDomain(agent),
    memory: buildMemoryDomain(agent),
    guardrails: buildGuardrailsDomain(agent),
    human_oversight: buildHumanOversightDomain(agent),
    inter_agent: buildInterAgentDomain(agent),
    supply_chain: buildSupplyChainDomain(agent),
    runtime: buildRuntimeDomain(),
  };

  return {
    domains,
    evidence_sources: [...sources].filter(Boolean),
  };
}
