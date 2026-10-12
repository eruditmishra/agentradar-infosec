import { Router } from "express";
import * as ctrl from "./discovery.controller";
import * as securityCtrl from "../security/security.controller";
import { requirePermission } from "../../rbac/rbac.middleware";

/**
 * All routes mount under /api/discovery
 * Auth middleware (requireAuth + attachTenant) is applied in app.ts
 * before mounting this router.
 *
 * Permission guards separate:
 *   - auto_discovery_config (enable/disable/configure)
 *   - discovery_results (view discovered agents/models)
 *   - scanning (trigger and view scans)
 */
const router = Router();

// ─── Auto Discovery Configuration ────────────────────────────────────────────
// These routes control WHETHER and HOW FREQUENTLY discovery runs.
// Separate from discovery_results which is just viewing what was found.
router.get("/settings", requirePermission("auto_discovery_config", "view"),      ctrl.getSettingsHandler);
router.put("/settings", requirePermission("auto_discovery_config", "configure"), ctrl.updateSettingsHandler);
router.get("/auto-findings", requirePermission("discovery_results", "view"),     ctrl.getAutoFindingsHandler);

// ─── Scans ────────────────────────────────────────────────────────────────────
router.post("/scans",                ctrl.startScanHandler);
router.get ("/scans",                ctrl.listScansHandler);
router.get ("/scans/:scanId",        ctrl.getScanHandler);
router.get ("/scans/:scanId/logs",   ctrl.getScanLogsHandler);
router.post("/scans/:scanId/logs",   ctrl.createScanLogHandler);

// ─── Agents ───────────────────────────────────────────────────────────────────
router.get  ("/agents",                       requirePermission("agents", "view"),    ctrl.listAgentsHandler);
router.get  ("/agents/filters",               requirePermission("agents", "view"),    ctrl.getAgentFiltersHandler);
router.get  ("/agents/:agentId",              requirePermission("agents", "view"),    ctrl.getAgentHandler);
router.patch("/agents/:agentId/status",       requirePermission("agents", "approve"), ctrl.updateAgentStatusHandler);
router.post("/agents/:agentId/request-approval", requirePermission("agents", "update"), ctrl.requestAgentApprovalHandler);
router.post("/agents/:agentId/approve",          requirePermission("agents", "approve"), ctrl.approveAgentHandler);

// ─── Security Assessment ──────────────────────────────────────────────────────
router.get ("/agents/:agentId/security-assessment",         requirePermission("agents", "view"),    securityCtrl.getSecurityAssessmentHandler);
router.post("/agents/:agentId/security-assessment/refresh", requirePermission("agents", "view"),    securityCtrl.refreshSecurityAssessmentHandler);
router.get ("/agents/:agentId/security-assessment/drift",   requirePermission("agents", "view"),    securityCtrl.getSecurityDriftHandler);

// ─── Multi-Framework Assessments (Governance & Compliance) ───────────────────
router.get ("/frameworks",   requirePermission("assessments", "view"), securityCtrl.getFrameworksHandler);
router.get ("/assessments",  requirePermission("assessments", "view"), securityCtrl.listAssessmentsHandler);

// ─── Models ───────────────────────────────────────────────────────────────────
router.get  ("/models",           requirePermission("models", "view"),   ctrl.listModelsHandler);
router.get  ("/models/filters",   requirePermission("models", "view"),   ctrl.getModelFiltersHandler);
router.get  ("/models/:modelId",  requirePermission("models", "view"),   ctrl.getModelHandler);
router.patch("/models/:modelId",  requirePermission("models", "manage"), ctrl.updateModelHandler);
router.post("/models/:modelId/request-approval", requirePermission("models", "update"),  ctrl.requestModelApprovalHandler);
router.post("/models/:modelId/approve",          requirePermission("models", "approve"), ctrl.approveModelHandler);

export default router;
