import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AccessTokenPayload } from "./auth.types";
import { config } from "../../shared/config";
import { UnauthorizedError } from "../../shared/errors";
import { getTokensValidAfter } from "./auth.repo";

/**
 * Verifies the JWT access token from cookie or Authorization header.
 * Attaches the decoded payload to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token =
    req.cookies?.access_token ||
    (authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined);

  if (!token) {
    return next(new UnauthorizedError("Authentication required"));
  }

  try {
    const payload = jwt.verify(
      token,
      config.jwt.accessSecret,
    ) as AccessTokenPayload & { iat: number };
    if (payload.type !== "access") {
      return next(new UnauthorizedError("Invalid token type"));
    }

    // Reject tokens issued before the user's last logout — closes the
    // window where a stateless JWT would otherwise stay valid post-logout.
    const validAfter = await getTokensValidAfter(payload.sub);
    if (validAfter && payload.iat * 1000 < validAfter.getTime()) {
      return next(new UnauthorizedError("Session has been revoked"));
    }

    (req as any).user = payload;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}

/**
 * Attaches tenantId (possibly null) to the request. Downstream repos must
 * branch on null vs value the same way auth.repo.ts does — never assume a
 * tenantId is present.
 */
export function attachTenant(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AccessTokenPayload | undefined;
  if (!user) return next(new UnauthorizedError("Authentication required"));
  (req as any).tenantId = user.tenantId;
  next();
}

/**
 * @deprecated Use requirePermission() from rbac.middleware.ts instead.
 * This is kept for backward compatibility during migration only.
 * Do NOT use requireRole() for new routes.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) return next(new UnauthorizedError("Authentication required"));
    const { ForbiddenError } = require("../../shared/errors");
    if (!allowedRoles.includes(user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
}
