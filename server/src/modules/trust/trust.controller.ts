import { Request, Response, NextFunction } from "express";
import * as svc from "./trust.service";
import type { ApproveModelInput } from "./trust.types";

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

import * as authService from "../auth/auth.service";

function getTenant(req: Request): string | null {
  return (req as any).tenantId ?? null;
}

function getUser(req: Request): string | null {
  return (req as any).user?.sub ?? null;
}

/**
 * POST /api/trust/models/:modelId/approve
 * Body: { status?: "approved" | "flagged" | "deprecated" | "under_review" | "pending" }
 */
export const approveModelHandler = asyncHandler(async (req, res) => {
  const modelId = req.params.modelId;
  const body = req.body as ApproveModelInput;
  const user = (req as any).user;
  
  // Default to approved if no status provided
  const status = body.status ?? "approved";

  // Fetch user from DB to get their email for the audit log payload
  let userEmail: string | null = null;
  if (user?.sub) {
    try {
      const dbUser = await authService.getUser(user.sub);
      userEmail = dbUser?.email ?? null;
    } catch (e) {
      // Ignore if user not found
    }
  }

  const result = await svc.approveModel(
    modelId,
    getTenant(req),
    getUser(req),
    status,
    { userEmail },
  );

  res.status(200).json(result);
});

