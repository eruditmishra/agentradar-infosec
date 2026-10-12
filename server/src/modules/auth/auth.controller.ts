import { Response } from "express";
import * as authService from "./auth.service";
import * as mfaService from "./mfa.service";
import * as microsoftStrategy from "./microsoft.strategy";
import * as oidcStrategy from "./oidc.strategy";
import * as ssoRepo from "./sso.repo";
import {
  extractGroups,
  resolveRoleFromGroups,
  validateRoleMappingConfig,
  DEFAULT_GROUPS_CLAIM,
} from "./roleMapping";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../../shared/config";
import { asyncHandler } from "../../shared/asyncHandler";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} from "../../shared/errors";
import * as audit from "../audit/audit.service";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const accessCookieOpts = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000,
  path: "/",
};

const refreshCookieOpts = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOpts);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

export const signupHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  try {
    const { accessToken, refreshToken } = await authService.signup({
      email,
      password,
      tenantId: config.tenantId,
    });
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ success: true });
  } catch (err: any) {
    if (err.message === "EMAIL_ALREADY_EXISTS") {
      throw new ConflictError("An account with this email already exists");
    }
    throw err;
  }
});

export const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  try {
    const { accessToken, refreshToken } = await authService.login({
      email,
      password,
      tenantId: config.tenantId,
    });
    setAuthCookies(res, accessToken, refreshToken);
    
    // Fetch user to return in payload so frontend state gets it immediately
    const decoded = jwt.verify(accessToken, config.jwt.accessSecret) as any;
    const user = await authService.getUser(decoded.sub);

    audit.log({
      tenantId: config.tenantId,
      userId: user.id,
      userEmail: user.email,
      eventType: "user.login",
      entityType: "user",
      action: "login",
      summary: `User ${user.email} logged in successfully via direct login`,
    });

    res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.email.split('@')[0],
        authMethod: user.authMethod,
        mfaEnabled: user.mfaEnabled,
        mfaEnrolled: user.mfaEnrolled,
        mfaVerified: decoded.mfaVerified as boolean,
      },
    });
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (err.message === "ACCOUNT_LOCKED") {
      throw new UnauthorizedError(
        "Too many failed login attempts. This account is temporarily locked — please try again later.",
      );
    }
    if (err.message === "USER_DEACTIVATED") {
      throw new UnauthorizedError("Your account has been deactivated. Please contact your administrator.");
    }
    if (err.message === "SSO_ACCOUNT_NO_PASSWORD") {
      throw new UnauthorizedError("Please sign in through your organization's SSO.");
    }
    if (err.message === "DIRECT_LOGIN_NOT_ALLOWED") {
      // Non-super-admin attempting direct login — direct to SSO (kept for safety though relaxed)
      throw new UnauthorizedError(
        "Direct login is restricted to Super Admin. Please sign in through your organization's SSO.",
      );
    }
    throw err;
  }
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawRefreshToken) {
    throw new UnauthorizedError("No refresh token provided");
  }

  try {
    const { accessToken, refreshToken } =
      await authService.refresh(rawRefreshToken);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({ success: true });
  } catch (err: any) {
    clearAuthCookies(res);
    if (err.message === "SESSION_IDLE_TIMEOUT") {
      throw new UnauthorizedError("Session expired due to inactivity");
    }
    throw new UnauthorizedError(err.message ?? "REFRESH_FAILED");
  }
});

export const logoutHandler = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.sub;
  const userEmail = (req as any).user?.email;

  if (userId) {
    await authService.logout(userId);
    audit.log({
      tenantId: config.tenantId,
      userId,
      userEmail,
      eventType: "user.logout",
      entityType: "user",
      action: "logout",
      summary: `User ${userEmail || userId} logged out`,
    });
  }
  
  clearAuthCookies(res);
  res.status(200).json({ success: true });
});

export const meHandler = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.sub;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }
  const user = await authService.getUser(userId);
  res.status(200).json({
    success: true,
    user: {
      email: user.email,
      role: user.role,
      name: user.email.split('@')[0],
      authMethod: user.authMethod,
      mfaEnabled: user.mfaEnabled,
      mfaEnrolled: user.mfaEnrolled,
      mfaVerified: (req as any).user?.mfaVerified as boolean,
    },
  });
});

// ─── MFA (TOTP) ───────────────────────────────────────────────────────────

export const mfaSetupHandler = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.sub;
  const email = (req as any).user?.email;
  const { otpauthUrl, qrCodeDataUrl } = await mfaService.generateEnrollment(userId, email);
  res.status(200).json({ success: true, otpauthUrl, qrCodeDataUrl });
});

export const mfaConfirmHandler = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.sub;
  const { token } = req.body;
  if (!token) throw new BadRequestError("Verification code is required");

  try {
    const { backupCodes } = await mfaService.confirmEnrollment(userId, token);
    const { accessToken, refreshToken } = await authService.issueMfaVerifiedTokenPair(userId);
    setAuthCookies(res, accessToken, refreshToken);

    audit.log({
      tenantId: config.tenantId,
      userId,
      userEmail: (req as any).user?.email,
      eventType: "user.mfa_enrolled",
      entityType: "user",
      action: "update",
      summary: `User ${(req as any).user?.email} completed MFA enrollment`,
    });

    res.status(200).json({ success: true, backupCodes });
  } catch (err: any) {
    if (err.message === "INVALID_MFA_CODE") {
      throw new UnauthorizedError("Incorrect verification code. Please try again.");
    }
    if (err.message === "MFA_SETUP_NOT_STARTED") {
      throw new BadRequestError("MFA setup has not been started for this account.");
    }
    throw err;
  }
});

export const mfaChallengeHandler = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.sub;
  const { token } = req.body;
  if (!token) throw new BadRequestError("Verification code is required");

  try {
    await mfaService.verifyChallenge(userId, token);
    const { accessToken, refreshToken } = await authService.issueMfaVerifiedTokenPair(userId);
    setAuthCookies(res, accessToken, refreshToken);

    audit.log({
      tenantId: config.tenantId,
      userId,
      userEmail: (req as any).user?.email,
      eventType: "user.mfa_verified",
      entityType: "user",
      action: "login",
      summary: `User ${(req as any).user?.email} completed MFA challenge`,
    });

    res.status(200).json({ success: true });
  } catch (err: any) {
    if (err.message === "INVALID_MFA_CODE") {
      throw new UnauthorizedError("Incorrect verification code.");
    }
    if (err.message === "MFA_NOT_ENABLED") {
      throw new BadRequestError("MFA is not enabled for this account.");
    }
    throw err;
  }
});

/**
 * GET /api/auth/microsoft
 * Generates a Microsoft authorization URL and redirects the user's browser there.
 * Stores a CSRF state token in a short-lived cookie.
 */
export const microsoftRedirectHandler = asyncHandler(async (req, res) => {
  if (!config.microsoft.clientId) {
    res.redirect("/login?error=sso_not_configured");
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie for CSRF validation on callback.
  res.cookie("ms_oauth_state", state, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax" as const, // lax required — cross-site redirect from Microsoft back to us
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: "/",
  });

  const authUrl = await microsoftStrategy.buildAuthorizationUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/microsoft/callback
 * Receives the authorization code from Microsoft, exchanges it for claims,
 * upserts the user, issues JWT pair, and redirects to the dashboard.
 */
export const microsoftCallbackHandler = asyncHandler(async (req, res) => {
  const expectedState = req.cookies?.ms_oauth_state;
  if (!expectedState) {
    throw new BadRequestError("Missing OAuth state cookie. Please try signing in again.");
  }

  // Clear the state cookie immediately.
  res.clearCookie("ms_oauth_state", { path: "/" });

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = protoStr ? protoStr.split(",")[0].trim() : (req.secure ? "https" : "http");
  const callbackUrl = `${protocol}://${req.headers.host}${req.originalUrl}`;

  let claims: Awaited<ReturnType<typeof microsoftStrategy.exchangeCodeForClaims>>;
  try {
    claims = await microsoftStrategy.exchangeCodeForClaims(callbackUrl, expectedState);
  } catch (err: any) {
    console.error("Microsoft SSO Callback Failed:", err);
    const frontendUrl = config.env === "production" ? "" : "http://localhost:5173";
    return res.redirect(`${frontendUrl}/login?error=sso_failed&details=${encodeURIComponent(err.message || "unknown")}`);
  }

  const frontendBase = config.env === "production" ? "" : "http://localhost:5173";

  try {
    // Use the AgentRadar tenantId from config (null for single-tenant deployments).
    const { accessToken, refreshToken } = await authService.loginWithMicrosoft(
      claims,
      config.tenantId,
    );
    setAuthCookies(res, accessToken, refreshToken);
    res.redirect(`${frontendBase}/`);
  } catch (err: any) {
    if (err.message === 'SSO_SUPERADMIN_ONLY') {
      return res.redirect(`${frontendBase}/login?error=sso_unauthorized`);
    }
    return res.redirect(`${frontendBase}/login?error=sso_failed`);
  }
});

export const getSSOConfigPublicHandler = asyncHandler(async (req, res) => {
  const configObj = await ssoRepo.getActiveSSOConfig(config.tenantId);
  if (!configObj) {
    return res.status(200).json({ success: true, sso: null });
  }
  res.status(200).json({
    success: true,
    sso: {
      providerId: configObj.provider_id,
      providerType: configObj.provider_type
    }
  });
});

/**
 * Builds the client-safe SSO settings payload. Explicitly whitelists fields
 * rather than spreading the raw DB row, so a future column added to
 * sso_configs can never leak to the frontend by accident (KPMGRQ-863317 #3).
 */
function toClientSafeSso(configObj: NonNullable<Awaited<ReturnType<typeof ssoRepo.getSSOConfig>>>) {
  return {
    id: configObj.id,
    provider_id: configObj.provider_id,
    provider_type: configObj.provider_type,
    is_active: configObj.is_active,
    config: redactSsoConfig(configObj.config),
    hasClientSecret: !!configObj.config?.clientSecret,
  };
}

export const getSSOSettingsHandler = asyncHandler(async (req, res) => {
  const configObj = await ssoRepo.getSSOConfig(config.tenantId);
  res.status(200).json({
    success: true,
    sso: configObj ? toClientSafeSso(configObj) : null,
  });
});

function redactSsoConfig(raw: any): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const { clientSecret, ...rest } = raw;
  return rest;
}

export const updateSSOSettingsHandler = asyncHandler(async (req, res) => {
  const { providerId, providerType, ssoConfig, isActive } = req.body;
  if (!providerId || !providerType) {
    throw new BadRequestError("Provider ID and Type are required");
  }
  const mappingErrors = validateRoleMappingConfig(ssoConfig);
  if (mappingErrors.length > 0) {
    throw new BadRequestError(`Invalid SSO configuration: ${mappingErrors.join("; ")}`);
  }
  const existing = await ssoRepo.getSSOConfig(config.tenantId);
  // clientSecret is write-only to the client (see getSSOSettingsHandler) — if
  // the frontend didn't send a new value, keep whatever is already stored.
  const nextSsoConfig = { ...(ssoConfig || {}) };
  if (!nextSsoConfig.clientSecret && existing?.config?.clientSecret) {
    nextSsoConfig.clientSecret = existing.config.clientSecret;
  }
  const updated = await ssoRepo.upsertSSOConfig(config.tenantId, providerId, providerType, nextSsoConfig, isActive);

  const actor = (req as any).user;
  audit.log({
    tenantId: config.tenantId,
    userId: actor?.sub ?? null,
    userEmail: actor?.email ?? null,
    eventType: "sso_config.update",
    entityType: "system",
    entityId: updated.id,
    entityName: providerId,
    action: "update",
    summary: `${actor?.email ?? "system"} updated SSO configuration for provider '${providerId}'`,
    before: existing
      ? {
          providerId: existing.provider_id,
          providerType: existing.provider_type,
          isActive: existing.is_active,
          ...redactSsoConfig(existing.config),
        }
      : null,
    after: {
      providerId,
      providerType,
      isActive,
      ...redactSsoConfig(ssoConfig),
    },
  });

  res.status(200).json({
    success: true,
    sso: toClientSafeSso(updated),
  });
});

export const ssoLoginHandler = asyncHandler(async (req, res) => {
  const ssoConfig = await ssoRepo.getActiveSSOConfig(config.tenantId);
  if (!ssoConfig) {
    return res.redirect("/login?error=sso_not_configured");
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("sso_oauth_state", state, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax" as const,
    maxAge: 10 * 60 * 1000,
    path: "/",
  });

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = protoStr ? protoStr.split(",")[0].trim() : (req.secure ? "https" : "http");
  const redirectUri = `${protocol}://${req.headers.host}/api/auth/sso/callback`;

  if (ssoConfig.provider_type === 'saml') {
    // Basic placeholder for SAML routing
    return res.redirect("/login?error=sso_failed");
  } else {
    // OIDC
    const additionalScopes: string[] = (ssoConfig.config?.additionalScopes as string | undefined)
      ?.split(/\s+/)
      .filter(Boolean) ?? [];
    const authUrl = await oidcStrategy.buildAuthorizationUrl(state, {
      issuerUrl: ssoConfig.config.issuerUrl,
      clientId: ssoConfig.config.clientId,
      clientSecret: ssoConfig.config.clientSecret
    }, redirectUri, additionalScopes);
    res.redirect(authUrl);
  }
});

export const ssoCallbackHandler = asyncHandler(async (req, res) => {
  const expectedState = req.cookies?.sso_oauth_state;
  if (!expectedState) {
    throw new BadRequestError("Missing OAuth state cookie. Please try signing in again.");
  }

  res.clearCookie("sso_oauth_state", { path: "/" });

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = protoStr ? protoStr.split(",")[0].trim() : (req.secure ? "https" : "http");
  const callbackUrl = `${protocol}://${req.headers.host}${req.originalUrl}`;
  const redirectUri = `${protocol}://${req.headers.host}/api/auth/sso/callback`;

  const ssoConfig = await ssoRepo.getActiveSSOConfig(config.tenantId);
  if (!ssoConfig) {
    const frontendUrl = config.env === "production" ? "" : "http://localhost:5173";
    return res.redirect(`${frontendUrl}/login?error=sso_not_configured`);
  }

  try {
    const claims = await oidcStrategy.exchangeCodeForClaims(callbackUrl, expectedState, {
      issuerUrl: ssoConfig.config.issuerUrl,
      clientId: ssoConfig.config.clientId,
      clientSecret: ssoConfig.config.clientSecret
    });

    const groupsClaimName = ssoConfig.config?.groupsClaim || DEFAULT_GROUPS_CLAIM;
    const userGroups = extractGroups(claims.allClaims, groupsClaimName);
    const resolvedRole = resolveRoleFromGroups(userGroups, ssoConfig.config ?? {});

    const { accessToken, refreshToken } = await authService.loginWithSso(
      claims.email,
      claims.sub,
      resolvedRole,
      config.tenantId
    );

    setAuthCookies(res, accessToken, refreshToken);

    const frontendBase = config.env === "production" ? "" : "http://localhost:5173";
    res.redirect(`${frontendBase}/`);
  } catch (err: any) {
    console.error("SSO Callback Failed:", err);
    const frontendUrl = config.env === "production" ? "" : "http://localhost:5173";
    if (err.message === 'SSO_SUPERADMIN_BLOCKED') {
      return res.redirect(`${frontendUrl}/login?error=sso_superadmin_blocked`);
    }
    return res.redirect(`${frontendUrl}/login?error=sso_failed&details=${encodeURIComponent(err.message || "unknown")}`);
  }
});
