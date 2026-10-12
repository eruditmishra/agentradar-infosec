import { Router } from "express";
import { requirePermission } from "../../rbac/rbac.middleware";
import * as ctrl from "./audit.controller";

const router = Router();

// ─── Agent-Level Audit Logs ───────────────────────────────────────────────────
// Accessible by: super_admin, admin, ciso, security_analyst, auditor
router.get("/logs",                       requirePermission("agent_audit_logs", "view"), ctrl.listAuditLogsHandler);
router.get("/logs/:entityType/:entityId", requirePermission("agent_audit_logs", "view"), ctrl.getEntityAuditLogsHandler);


// ─── Frontend Telemetry ───────────────────────────────────────────────────────
// Any authenticated session can send telemetry events
router.post("/event",          ctrl.eventHandler);
router.post("/business-event", ctrl.businessEventHandler);

export default router;
