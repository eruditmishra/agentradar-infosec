import { Router } from "express";
import * as controller from "./trust.controller";
import { requirePermission } from "../../rbac/rbac.middleware";

const router = Router();

// Manual approval: super_admin, admin, security_analyst
router.post("/models/:modelId/approve", requirePermission("manual_approval", "approve"), controller.approveModelHandler);

export default router;
