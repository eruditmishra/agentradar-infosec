// ─── audit.controller.ts ──────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import * as svc from "./audit.service";
import * as repo from "./audit.repo";
import { logAccess } from "./audit.service";
import * as authService from "../auth/auth.service";
import type { ListAuditLogsOpts, ListAccessLogsOpts, AuditEntityType } from "./audit.types";
import { assertSafeText, assertSafeStringFields } from "../../shared/sanitize";

function getTenant(req: Request): string | null {
  return (req as any).tenantId ?? null;
}

function getUser(req: Request) {
  return (req as any).user as { sub?: string; email?: string } | undefined;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

/**
 * GET /api/audit/logs
 * Query params: entityType, entityId, userId, eventType, since, until, limit, offset
 */
export const listAuditLogsHandler = asyncHandler(async (req, res) => {
  const tenantId = getTenant(req);
  const {
    entityType,
    entityId,
    userId,
    eventType,
    since,
    until,
    limit,
    offset,
  } = req.query as Record<string, string>;

  const opts: ListAuditLogsOpts = {
    entityType: entityType as AuditEntityType | undefined,
    entityId,
    userId,
    eventType,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(until) : undefined,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  };

  const result = await svc.listLogs(tenantId, opts);
  res.json(result);
});

/**
 * GET /api/audit/logs/:entityType/:entityId
 * Full audit history for a specific entity (connector, agent, model, scan).
 */
export const getEntityAuditLogsHandler = asyncHandler(async (req, res) => {
  const tenantId = getTenant(req);
  const { entityType, entityId } = req.params;
  const { limit, offset } = req.query as Record<string, string>;

  const result = await svc.listLogs(tenantId, {
    entityType: entityType as AuditEntityType,
    entityId,
    limit: limit ? parseInt(limit, 10) : 100,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  res.json(result);
});


/**
 * POST /api/audit/event
 * Client-side beacon for frontend telemetry events (pageviews, clicks, etc.).
 * Body: { type: 'pageview' | 'click', path: string, metadata?: any, timestamp?: string }
 *
 * Uses navigator.sendBeacon on the frontend, so body may be text/plain.
 */
export const eventHandler = asyncHandler(async (req, res) => {
  const user = getUser(req);
  const tenantId = getTenant(req);

  let body = req.body as { type?: string; path?: string; metadata?: any; timestamp?: string };

  // sendBeacon sends text/plain; try to parse it if needed
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const eventType = String(body?.type ?? "pageview").toUpperCase();
  const path = String(body?.path ?? "/unknown").slice(0, 500);
  const metadata = typeof body?.metadata === 'object' && body?.metadata !== null ? body.metadata : {};

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  logAccess({
    tenantId,
    userId: user?.sub ?? null,
    userEmail: user?.email ?? null,
    ipAddress: ip,
    userAgent: req.headers["user-agent"] ?? null,
    method: eventType === "CLICK" ? "CLICK" : "PAGEVIEW",
    path: path,
    metadata: {
      ...metadata,
      client_timestamp: body?.timestamp ?? null,
    },
  });

  // sendBeacon typically expects a 2xx response, no body needed
  res.status(204).send();
});


export const businessEventHandler = asyncHandler(async (req, res) => {
  const tenantId = getTenant(req);
  const user = (req as any).user;
  const { eventType, entityType, entityId, summary, details } = req.body;

  if (!eventType || !summary) {
    res.status(400).json({ error: "Missing eventType or summary" });
    return;
  }
  assertSafeText(summary, "summary", { required: true, maxLength: 255 });
  if (details && typeof details === "object") {
    assertSafeStringFields(details, "details");
  } else {
    assertSafeText(details, "details", { maxLength: 1000 });
  }

  let userEmail: string | null = null;
  if (user?.sub) {
    try {
      const dbUser = await authService.getUser(user.sub);
      userEmail = dbUser?.email ?? null;
    } catch (e) {
      // Ignore if user not found
    }
  }

  svc.log({
    tenantId: getTenant(req),
    userId: user?.sub ?? null,
    userEmail: userEmail,
    eventType: String(eventType).slice(0, 50),
    entityType: entityType as AuditEntityType,
    entityId: entityId ? String(entityId).slice(0, 100) : undefined,
    action: "read" as any,
    summary: String(summary).slice(0, 255),
    metadata: details,
  });

  res.status(204).send();
});
