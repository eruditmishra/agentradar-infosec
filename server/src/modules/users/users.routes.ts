import { Router } from "express";
import { requirePermission } from "../../rbac/rbac.middleware";
import * as ctrl from "./users.controller";

const router = Router();

router.get("/", requirePermission("user_management", "view"), ctrl.listUsersHandler);
router.post("/", requirePermission("user_management", "create"), ctrl.createUserHandler);
router.put("/:id", requirePermission("user_management", "update"), ctrl.updateUserHandler);
router.post("/:id/status", requirePermission("user_management", "update"), ctrl.setStatusHandler);
router.post("/:id/reset-password", requirePermission("user_management", "update"), ctrl.resetPasswordHandler);
router.post("/:id/mfa", requirePermission("user_management", "update"), ctrl.setMfaHandler);
router.delete("/:id", requirePermission("user_management", "delete"), ctrl.deleteUserHandler);

export default router;
