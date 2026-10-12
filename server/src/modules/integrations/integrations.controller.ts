import type { Request, Response, NextFunction } from "express";
import * as svc from "./integrations.service";
import type { IntegrationProvider } from "./integrations.types";

function getTenant(req: Request) {
  return (req as any).tenantId || null;
}

/**
 * Response-boundary guard (KPMGRQ-863317 #3): strips any secret-bearing key
 * before a connector record ever reaches the client, even if a future
 * service/repo change accidentally starts including one. The frontend never
 * needs decrypted secrets or the encrypted blob — connectors are configured
 * write-only and tested server-side (see testIntegrationHandler).
 */
const SECRET_KEYS = ["secrets", "secrets_encrypted"] as const;

export function toClientSafe<T extends object>(record: T): Omit<T, "secrets" | "secrets_encrypted"> {
  const safe: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const key of SECRET_KEYS) delete safe[key];
  return safe as unknown as Omit<T, "secrets" | "secrets_encrypted">;
}

export function toClientSafeList<T extends object>(records: T[]): Omit<T, "secrets" | "secrets_encrypted">[] {
  return records.map(toClientSafe);
}

export async function createIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const user = (req as any).user;
    const result = await svc.createIntegration(tenantId, {
      ...req.body,
      createdBy: {
        userId: user?.sub ?? null,
        userEmail: user?.email ?? null,
        ipAddress:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          null,
      },
    });
    res.status(201).json(toClientSafe(result));
  } catch (err) {
    next(err);
  }
}

export async function updateIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const user = (req as any).user;
    const result = await svc.updateIntegration(
      req.params.integrationId,
      tenantId,
      req.body,
      {
        userId: user?.sub ?? null,
        userEmail: user?.email ?? null,
      },
    );
    res.json(toClientSafe(result));
  } catch (err) {
    next(err);
  }
}

export async function getIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const result = await svc.getIntegration(req.params.integrationId, tenantId);
    res.json(toClientSafe(result));
  } catch (err) {
    next(err);
  }
}

export async function listIntegrationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const { provider, status, limit, offset } = req.query;
    const result = await svc.listIntegrations(tenantId, {
      provider: provider as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    res.json({ ...result, items: toClientSafeList(result.items) });
  } catch (err) {
    next(err);
  }
}

export async function deleteIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const user = (req as any).user;
    await svc.deleteIntegration(req.params.integrationId, tenantId, {
      userId: user?.sub ?? null,
      userEmail: user?.email ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function testIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getTenant(req);
    const user = (req as any).user;
    const result = await svc.testIntegration(req.params.integrationId, tenantId, {
      userId: user?.sub ?? null,
      userEmail: user?.email ?? null,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
