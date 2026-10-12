// ─── audit.middleware.ts ──────────────────────────────────────────────────────
// Express middleware that automatically records every HTTP request into
// system_access_logs. Register this AFTER requireAuth so that user context
// is available on the request object.

import { Request, Response, NextFunction } from "express";
import { logAccess } from "../../modules/audit/audit.service";
import { AppError } from "../errors";

function getIp(req: Request): string | null {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Captures every inbound HTTP request and writes a system_access_log entry
 * on response finish. Fire-and-forget — never delays the response.
 */
export function systemAccessLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();

  res.on("finish", () => {
    const user = (req as any).user as
      | { sub?: string; tenantId?: string | null; email?: string }
      | undefined;

    // Don't log health-check or metrics endpoints
    if (req.path === "/health" || req.path === "/metrics") return;

    const durationMs = Date.now() - startedAt;
    const errorCode =
      res.statusCode >= 400 ? (res.locals.errorCode as string) ?? null : null;
    const errorMessage =
      res.statusCode >= 400
        ? (res.locals.errorMessage as string) ?? null
        : null;

    logAccess({
      tenantId: user?.tenantId ?? null,
      userId: user?.sub ?? null,
      userEmail: user?.email ?? null,
      ipAddress: getIp(req),
      userAgent: req.headers["user-agent"] ?? null,
      method: req.method,
      path: req.path,
      queryParams:
        Object.keys(req.query).length > 0
          ? (req.query as Record<string, unknown>)
          : null,
      statusCode: res.statusCode,
      durationMs,
      requestSize: req.headers["content-length"]
        ? parseInt(req.headers["content-length"], 10)
        : null,
      errorCode,
      errorMessage,
    });
  });

  next();
}
