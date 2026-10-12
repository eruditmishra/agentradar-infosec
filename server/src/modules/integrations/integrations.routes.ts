import { Router } from "express";
import * as ctrl from "./integrations.controller";
import { requirePermission } from "../../rbac/rbac.middleware";

const router = Router();

// Accessible by: super_admin, admin, security_analyst (view)
// Manage (create, update, delete, test) restricted to: super_admin, admin
router.get   ("/",                    requirePermission("integrations", "view"),   ctrl.listIntegrationsHandler);
router.get   ("/:integrationId",      requirePermission("integrations", "view"),   ctrl.getIntegrationHandler);
router.post  ("/",                    requirePermission("integrations", "manage"),  ctrl.createIntegrationHandler);
router.patch ("/:integrationId",      requirePermission("integrations", "update"),  ctrl.updateIntegrationHandler);
router.delete("/:integrationId",      requirePermission("integrations", "delete"),  ctrl.deleteIntegrationHandler);
router.post  ("/:integrationId/test", requirePermission("integrations", "manage"),  ctrl.testIntegrationHandler);

export default router;
