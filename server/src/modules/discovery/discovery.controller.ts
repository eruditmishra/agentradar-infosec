import { Request, Response, NextFunction } from "express";
import * as svc from "./discovery.service";
import * as audit from "../audit/audit.service";
import * as trustService from "../trust/trust.service";
import * as repo from "./discovery.repo";
import { assertSafeText } from "../../shared/sanitize";
import type {
  AgentGovernanceStatus,
  CreateConnectorInput,
  ScanProvider,
  StartScanInput,
  UpdateConnectorInput,
  UpdateModelInput,
} from "./discovery.types";

// ─── Utility ─────────────────────────────────────────────────────────────────

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function getTenant(req: Request): string | null {
  return (req as any).tenantId ?? null;
}

function getUser(req: Request): string | null {
  return (req as any).user?.sub ?? null;
}

function getUserEmail(req: Request): string | null {
  return (req as any).user?.email ?? null;
}

function paginationOpts(req: Request) {
  return {
    limit: Math.min(Number(req.query.limit) || 50, 200),
    offset: Number(req.query.offset) || 0,
  };
}


// ─── SETTINGS & FINDINGS HANDLERS ───────────────────────────────────────────────

export const getSettingsHandler = asyncHandler(async (req, res) => {
  const settings = await svc.getSettings(getTenant(req));
  res.json(settings);
});

export const updateSettingsHandler = asyncHandler(async (req, res) => {
  const { is_enabled, auto_scan_frequency } = req.body;
  if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(auto_scan_frequency)) {
    res.status(400).json({ error: "Invalid frequency" });
    return;
  }
  await svc.upsertSettings(getTenant(req), Boolean(is_enabled), auto_scan_frequency);
  
  audit.log({
    tenantId: getTenant(req),
    userId: getUser(req),
    userEmail: getUserEmail(req),
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    eventType: "system.settings_changed",
    entityType: "system",
    entityId: "auto_discovery",
    action: "update",
    summary: `Updated auto discovery settings: ${is_enabled ? 'enabled' : 'disabled'} (${auto_scan_frequency})`,
    after: { is_enabled, auto_scan_frequency }
  });

  res.json({ success: true, is_enabled: Boolean(is_enabled), auto_scan_frequency });
});

export const getAutoFindingsHandler = asyncHandler(async (req, res) => {
  const findings = await svc.getLatestAutoFindings(getTenant(req));
  res.json({ findings });
});

// ─── SCAN HANDLERS ────────────────────────────────────────────────────────────

/**
 * POST /api/discovery/scans
 * Body: { integration_ids?: string[], scan_all?: boolean }
 * Returns: 202 + { scanId }
 */
export const startScanHandler = asyncHandler(async (req, res) => {
  const body = req.body as StartScanInput;

  if (!body.scan_all && (!Array.isArray(body.integration_ids) || !body.integration_ids.length)) {
    res.status(400).json({
      error: "Provide integration_ids (array) or set scan_all: true",
    });
    return;
  }

  const result = await svc.startScan(getTenant(req), body, getUser(req), getUserEmail(req));
  res.status(202).json(result);
});

/**
 * GET /api/discovery/scans
 * Query: status?, limit?, offset?
 */
export const listScansHandler = asyncHandler(async (req, res) => {
  const scans = await svc.listScans(getTenant(req), {
    status: req.query.status as string | undefined,
    ...paginationOpts(req),
  });
  res.json({ scans, total: scans.length });
});

/**
 * GET /api/discovery/scans/:scanId
 */
export const getScanHandler = asyncHandler(async (req, res) => {
  const scan = await svc.getScan(req.params.scanId, getTenant(req));
  res.json({ scan });
});

/**
 * GET /api/discovery/scans/:scanId/logs
 * Query: limit?, offset?
 */
export const getScanLogsHandler = asyncHandler(async (req, res) => {
  const logs = await svc.getScanLogs(
    req.params.scanId,
    getTenant(req),
    paginationOpts(req),
  );
  res.json({ logs, total: logs.length });
});

/**
 * POST /api/discovery/scans/:scanId/logs
 * Body: { level: 'info'|'warn'|'error', message: string, integration_id?, metadata? }
 */
export const createScanLogHandler = asyncHandler(async (req, res) => {
  const { level, message, integration_id, metadata } = req.body;

  if (!level || !message) {
    res.status(400).json({ error: "level and message are required" });
    return;
  }
  if (!["info", "warn", "error"].includes(level)) {
    res.status(400).json({ error: "level must be info, warn, or error" });
    return;
  }
  assertSafeText(message, "message", { required: true, maxLength: 2000 });

  const log = await svc.addScanLog(
    req.params.scanId,
    getTenant(req),
    level,
    message,
    integration_id,
    metadata,
  );
  res.status(201).json({ log });
});

// ─── AGENT HANDLERS ───────────────────────────────────────────────────────────

/**
 * GET /api/discovery/agents
 * Query: provider?, integrationId?, status?, agentStatus?, riskIndicator?, limit?, offset?
 */
export const listAgentsHandler = asyncHandler(async (req, res) => {
  const result = await svc.listAgents(getTenant(req), {
    provider:      req.query.provider      as string | undefined,
    integrationId: req.query.integrationId as string | undefined,
    status:        req.query.status        as string | undefined,
    agentStatus:   req.query.agentStatus   as string | undefined,
    riskIndicator: req.query.riskIndicator as string | undefined,
    model:         req.query.model         as string | undefined,
    owner:         req.query.owner         as string | undefined,
    type:          req.query.type          as string | undefined,
    search:        req.query.search        as string | undefined,
    sortBy:        req.query.sortBy        as string | undefined,
    sortOrder:     req.query.sortOrder     as 'asc' | 'desc' | undefined,
    // hasModel=true  → only records WITH a model (real agents)
    // hasModel=false → only records WITHOUT a model (pure identities)
    hasModel:      req.query.hasModel !== undefined
                     ? req.query.hasModel === 'true'
                     : undefined,
    // excludeIdentities=true → exclude (deployment_type=identity AND model IS NULL) records
    // This keeps all cloud agents even without a model, drops pure service principals
    excludeIdentities: req.query.excludeIdentities !== undefined
                         ? req.query.excludeIdentities === 'true'
                         : undefined,
    ...paginationOpts(req),
  });
  res.json({ agents: result.agents, total: result.total });
});

/**
 * GET /api/discovery/agents/filters
 */
export const getAgentFiltersHandler = asyncHandler(async (req, res) => {
  const filters = await svc.getAgentFilters(getTenant(req));
  res.json(filters);
});

/**
 * GET /api/discovery/agents/:agentId
 */
export const getAgentHandler = asyncHandler(async (req, res) => {
  if (!isUUID(req.params.agentId)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const agent = await svc.getAgent(req.params.agentId, getTenant(req));
  res.json({ agent });
});

/**
 * PATCH /api/discovery/agents/:agentId/status
 * Body: { status: 'shadow'|'reviewed'|'approved'|'flagged' }
 */
export const updateAgentStatusHandler = asyncHandler(async (req, res) => {
  if (!isUUID(req.params.agentId)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const VALID: AgentGovernanceStatus[] = ["shadow", "reviewed", "approved", "flagged"];
  const status = req.body.status as AgentGovernanceStatus;

  if (!VALID.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` });
    return;
  }

  const agent = await svc.updateAgentStatus(req.params.agentId, getTenant(req), status, {
    userId: getUser(req),
    userEmail: getUserEmail(req),
  });
  res.json({ agent });
});

/**
 * POST /api/discovery/agents/:agentId/request-approval
 * Body: { requested_status: 'conditionally_approved' | 'conditionally_shadow', request_remark: string }
 */
export const requestAgentApprovalHandler = asyncHandler(async (req, res) => {
  const requestedStatus = req.body.requested_status;
  const requestRemark = req.body.request_remark;

  if (requestedStatus !== "conditionally_approved" && requestedStatus !== "conditionally_shadow") {
    res.status(400).json({ error: "requested_status must be 'conditionally_approved' or 'conditionally_shadow'" });
    return;
  }
  if (!requestRemark || typeof requestRemark !== "string" || requestRemark.trim() === "") {
    res.status(400).json({ error: "request_remark is mandatory" });
    return;
  }
  assertSafeText(requestRemark, "request_remark", { required: true, maxLength: 2000 });

  const currentAgent = await svc.getAgent(req.params.agentId, getTenant(req));
  if (!currentAgent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const agent = await repo.updateAgent(
    req.params.agentId,
    getTenant(req),
    { 
      status: "under_review",
      requested_status: requestedStatus as any,
      previous_status: currentAgent.status as any,
      request_remark: requestRemark
    }
  );

  const user = (req as any).user;
  const userEmail = user?.email ?? null;
  const agentName = (agent?.agent_config as any)?.name || agent?.id || "Unknown Agent";

  audit.log({
    tenantId: getTenant(req),
    userId: getUser(req),
    userEmail,
    eventType: "agent.approval_requested",
    entityType: "agent",
    entityId: agent!.id,
    entityName: agentName,
    action: "update",
    status: "success",
    summary: `${userEmail ?? "system"} requested to change agent '${agentName}' to '${requestedStatus}'. Remark: ${requestRemark}`,
    before: { status: currentAgent.status },
    after: { status: "under_review", requested_status: requestedStatus, request_remark: requestRemark },
  });

  res.json({ agent });
});

/**
 * POST /api/discovery/agents/:agentId/approve
 * Body: { action: 'approve' | 'reject', approval_remark?: string, status?: 'conditionally_approved' | 'conditionally_shadow' }
 */
export const approveAgentHandler = asyncHandler(async (req, res) => {
  const action = req.body.action;
  const approvalRemark = req.body.approval_remark || null;
  const directStatus = req.body.status;

  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    return;
  }
  assertSafeText(approvalRemark, "approval_remark", { maxLength: 2000 });

  const currentAgent = await svc.getAgent(req.params.agentId, getTenant(req));
  if (!currentAgent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  let newStatus = currentAgent.status;

  if (currentAgent.status === "under_review") {
    if (action === "approve" && currentAgent.requested_status) {
      // Only require owner for full approval, not for conditional approval
      if ((currentAgent.requested_status === "approved") &&
          (!currentAgent.owner || currentAgent.owner.trim() === '')) {
        res.status(400).json({ error: "Cannot approve an agent without an owner. Mark as 'conditionally_approved' instead." });
        return;
      }
      newStatus = currentAgent.requested_status as any;
    } else if (action === "reject" && currentAgent.previous_status) {
      newStatus = currentAgent.previous_status as any;
    } else {
      newStatus = "shadow" as any;
    }
  } else {
    // Direct approval from CISO
    if (action === "approve" && directStatus) {
      // Only require owner for full approval, not for conditional approval
      if ((directStatus === "conditionally_shadow") &&
          (!currentAgent.owner || currentAgent.owner.trim() === '')) {
        res.status(400).json({ error: "Cannot set conditionally_shadow without an owner." });
        return;
      }
      if (directStatus !== "conditionally_approved" && directStatus !== "conditionally_shadow") {
        res.status(400).json({ error: "status must be 'conditionally_approved' or 'conditionally_shadow'" });
        return;
      }
      newStatus = directStatus;
    } else if (action === "reject") {
      newStatus = "shadow" as any;
    }
  }

  const user = (req as any).user;
  const userEmail = user?.email ?? null;

  // Apply status and trigger cascades + audit logs using trustService
  await trustService.approveAgent(
    req.params.agentId,
    getTenant(req),
    getUser(req),
    newStatus as any,
    { userEmail, remark: approvalRemark || undefined }
  );

  // Clear requested/previous/remark statuses via standard update
  const agent = await repo.updateAgent(
    req.params.agentId,
    getTenant(req),
    { 
      requested_status: null,
      previous_status: null,
      request_remark: null,
      approval_remark: approvalRemark
    }
  );
  
  res.json({ agent });
});

// ─── MODEL HANDLERS ───────────────────────────────────────────────────────────

/**
 * GET /api/discovery/models
 * Query: provider?, validationStatus?, riskLevel?, limit?, offset?
 */
export const listModelsHandler = asyncHandler(async (req, res) => {
  const result = await svc.listModels(getTenant(req), {
    provider:         req.query.provider         as string | undefined,
    validationStatus: req.query.validationStatus as string | undefined,
    riskLevel:        req.query.riskLevel        as string | undefined,
    search:           req.query.search           as string | undefined,
    sortBy:           req.query.sortBy           as string | undefined,
    sortOrder:        req.query.sortOrder        as 'asc' | 'desc' | undefined,
    ...paginationOpts(req),
  });
  res.json({ models: result.models, total: result.total });
});

/**
 * GET /api/discovery/models/filters
 */
export const getModelFiltersHandler = asyncHandler(async (req, res) => {
  const filters = await svc.getModelFilters(getTenant(req));
  res.json(filters);
});

/**
 * GET /api/discovery/models/:modelId
 * Returns model + array of agents using it
 */
export const getModelHandler = asyncHandler(async (req, res) => {
  const model = await svc.getModel(req.params.modelId, getTenant(req));
  res.json({ model });
});

/**
 * PATCH /api/discovery/models/:modelId
 * Body: { display_name?, validation_status?, risk_level?, model_type?, notes? }
 */
export const updateModelHandler = asyncHandler(async (req, res) => {
  const patch = req.body as UpdateModelInput;
  assertSafeText(patch.display_name, "display_name", { maxLength: 255 });
  assertSafeText(patch.notes, "notes", { maxLength: 2000 });
  const model = await svc.updateModel(
    req.params.modelId,
    getTenant(req),
    patch,
    getUser(req),
  );
  res.json({ model });
});

/**
 * POST /api/discovery/models/:modelId/request-approval
 * Body: { requested_status: 'approved' | 'flagged' }
 */
export const requestModelApprovalHandler = asyncHandler(async (req, res) => {
  const requestedStatus = req.body.requested_status;
  if (requestedStatus !== "approved" && requestedStatus !== "flagged") {
    res.status(400).json({ error: "requested_status must be 'approved' or 'flagged'" });
    return;
  }

  const currentModel = await svc.getModel(req.params.modelId, getTenant(req));
  if (!currentModel) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const model = await svc.updateModel(
    req.params.modelId,
    getTenant(req),
    { 
      validation_status: "under_review",
      requested_status: requestedStatus,
      previous_status: currentModel.validation_status
    },
    getUser(req)
  );

  const user = (req as any).user;
  const userEmail = user?.email ?? null;
  const modelName = model.display_name || model.name;

  audit.log({
    tenantId: getTenant(req),
    userId: getUser(req),
    userEmail,
    eventType: "model.approval_requested",
    entityType: "model",
    entityId: model.id,
    entityName: modelName,
    action: "update",
    status: "success",
    summary: `${userEmail ?? "system"} requested to change model '${modelName}' to '${requestedStatus}'`,
    before: { validation_status: currentModel.validation_status },
    after: { validation_status: "under_review", requested_status: requestedStatus },
  });

  res.json({ model });
});

/**
 * POST /api/discovery/models/:modelId/approve
 * Body: { action: 'approve' | 'reject' }
 */
export const approveModelHandler = asyncHandler(async (req, res) => {
  const action = req.body.action;
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    return;
  }

  const currentModel = await svc.getModel(req.params.modelId, getTenant(req));
  if (!currentModel) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  let newStatus = currentModel.validation_status;
  
  if (currentModel.validation_status === "under_review") {
    if (action === "approve" && currentModel.requested_status) {
      newStatus = currentModel.requested_status as any;
    } else if (action === "reject" && currentModel.previous_status) {
      newStatus = currentModel.previous_status as any;
    } else {
      newStatus = "pending" as any;
    }
  } else {
    if (action === "approve") {
      newStatus = "approved" as any;
    } else if (action === "reject") {
      newStatus = "flagged" as any;
    }
  }

  const user = (req as any).user;
  
  // Apply status and trigger cascades + audit logs using trustService
  await trustService.approveModel(
    req.params.modelId,
    getTenant(req),
    getUser(req),
    newStatus as any,
    { userEmail: user?.email ?? null }
  );

  // Clear requested/previous status via standard update
  const model = await svc.updateModel(
    req.params.modelId,
    getTenant(req),
    { 
      requested_status: null,
      previous_status: null
    },
    getUser(req)
  );
  
  res.json({ model });
});
