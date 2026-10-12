import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../shared/errors";
import { hasPermission, Resource, Action, DIRECT_LOGIN_ROLES, SSO_ONLY_ROLES, Role } from "./permissions";
import { AccessTokenPayload } from "../modules/auth/auth.types";

// ─── Core Permission Middleware ───────────────────────────────────────────────

/**
 * Express middleware factory that checks whether the authenticated user's role
 * has explicit permission for the given resource + action combination.
 *
 * Usage:
 *   router.put("/settings", requirePermission("auto_discovery_config", "configure"), handler)
 *
 * Never use role-string comparisons directly in handlers.
 * Always use this middleware or the hasPermission() helper.
 */
export function requirePermission(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!hasPermission(user.role, resource, action)) {
      return next(
        new ForbiddenError(
          `Access denied: role '${user.role}' does not have '${action}' on '${resource}'`,
        ),
      );
    }

    next();
  };
}

/**
 * Shorthand for routes that only Super Admin can access.
 * Equivalent to requirePermission but with a clearer intent signal in route files.
 */
export function requireSuperAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (user.role !== "super_admin") {
      return next(new ForbiddenError("Super Admin access required"));
    }
    next();
  };
}

// ─── Authentication Method Guards ────────────────────────────────────────────

/**
 * Ensures the request came from a user who authenticated via direct login
 * (username + password), not SSO. Used to protect Super Admin operations.
 *
 * Note: authMethod is embedded in the JWT at token issuance time.
 */
export function requireDirectLogin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (user.authMethod !== "password") {
      return next(
        new ForbiddenError(
          "This operation requires direct login authentication",
        ),
      );
    }
    next();
  };
}

/**
 * Ensures the request came from an SSO-authenticated user.
 * Rejects users who authenticated via direct username/password login.
 */
export function requireSsoLogin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (user.authMethod === "password") {
      return next(
        new ForbiddenError(
          "This operation requires SSO authentication",
        ),
      );
    }
    next();
  };
}

// ─── MFA Guard ───────────────────────────────────────────────────────────────

/**
 * MFA enforcement middleware.
 *
 * MFA enforcement is ON by default. Set MFA_ENFORCEMENT_ENABLED=false to
 * disable it as an emergency escape hatch (e.g. a super_admin is locked out
 * and needs direct DB access to clear their MFA before this can be re-enabled).
 *
 * When enabled, this middleware checks the `mfaVerified` claim in the JWT.
 * Only users with `mfa_enabled=true` on their account (super_admin, by
 * default, or any other password-login user opted in via User Management)
 * are actually required to complete a TOTP challenge — see
 * issueTokenPair() in auth.service.ts. Everyone else's mfaVerified is
 * always true.
 */
export const MFA_ENFORCEMENT_ENABLED = process.env.MFA_ENFORCEMENT_ENABLED !== "false";

export function requireMfaVerified() {
  return (req: Request, res: Response, next: NextFunction) => {
    // MFA enforcement is currently disabled. Flip MFA_ENFORCEMENT_ENABLED to enable.
    if (!MFA_ENFORCEMENT_ENABLED) {
      return next();
    }

    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!user.mfaVerified) {
      return next(
        new ForbiddenError(
          "MFA verification required to access this resource",
        ),
      );
    }

    next();
  };
}

// ─── Role Validation Guard ────────────────────────────────────────────────────

/**
 * Validates that the user's role is one of the allowed roles.
 * Prefer requirePermission() over this — it is more granular and future-proof.
 * Use this only when you need to gate on a specific role set without a resource context.
 */
export function requireRole(...allowedRoles: (Role | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AccessTokenPayload | undefined;
    if (!user) return next(new UnauthorizedError("Authentication required"));
    if (!allowedRoles.includes(user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
}
