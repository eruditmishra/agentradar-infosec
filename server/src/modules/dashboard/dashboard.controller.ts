import { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import * as dashboardService from "./dashboard.service";

export const getDashboardDataHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId || null;
  const data = await dashboardService.getDashboardData(tenantId);
  res.status(200).json(data);
});

export const getShadowStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId || null;
  const data = await dashboardService.getShadowAgentStats(tenantId);
  res.status(200).json(data);
});

export const getModelStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId || null;
  const data = await dashboardService.getModelStats(tenantId);
  res.status(200).json(data);
});

export const getVerifiedStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId || null;
  const data = await dashboardService.getVerifiedAgentStats(tenantId);
  res.status(200).json(data);
});
