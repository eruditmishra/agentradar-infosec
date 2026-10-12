import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import {
  findUserByEmail,
  createUser,
  storeRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  findUserById,
  createOrLinkMicrosoftUser,
  createOrLinkSsoUser,
  updateLastLogin,
  invalidateTokensBefore,
  registerFailedLogin,
  resetFailedLogins,
} from "./auth.repo";
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  SignupInput,
  LoginInput,
  MicrosoftIdTokenClaims,
} from "./auth.types";
import { config } from "../../shared/config";
import { Role, DIRECT_LOGIN_ROLES, SSO_ONLY_ROLES } from "../../rbac/permissions";
import { MFA_ENFORCEMENT_ENABLED } from "../../rbac/rbac.middleware";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity ends the session

const FAILED_LOGIN_LOCKOUT_THRESHOLD = 5; // lock after 5 consecutive bad passwords
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout window

function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
): string {
  return jwt.sign({ ...payload, type: "access" }, config.jwt.accessSecret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, config.jwt.refreshSecret, {
    expiresIn: "30d",
  });
}

/**
 * Issues a JWT access + refresh token pair.
 * authMethod is embedded into the access token so downstream middleware
 * can enforce authentication method requirements without a DB lookup.
 *
 * mfaVerified is true unless MFA enforcement is on AND this specific user
 * has MFA enabled (only password-login users can have mfa_enabled=true —
 * SSO/Microsoft logins are out of scope for TOTP MFA). When false, the
 * session is authenticated-but-unverified until POST /api/auth/mfa/challenge
 * (or the initial setup flow) re-issues the pair with mfaVerified: true.
 */
async function issueTokenPair(
  userId: string,
  email: string | null,
  tenantId: string | null,
  role: Role,
  authMethod: "password" | "sso" | "microsoft",
  mfaEnabled: boolean = false,
) {
  const mfaVerified = !MFA_ENFORCEMENT_ENABLED || !mfaEnabled;

  const accessToken = signAccessToken({
    sub: userId,
    email,
    tenantId,
    role,
    authMethod,
    mfaVerified,
  });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, tenantId, jti });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await storeRefreshToken(userId, jti, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput) {
  const existing = await findUserByEmail(input.tenantId, input.email);
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await createUser(input.tenantId, input.email, passwordHash);

  return issueTokenPair(user.id, user.email, user.tenant_id, user.role as Role, "password", user.mfa_enabled);
}

/**
 * Direct password login.
 * Allowed for all roles according to POC requirements.
 * Validates that the account is active.
 */
export async function login(input: LoginInput) {
  const user = await findUserByEmail(input.tenantId, input.email);
  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.is_active) throw new Error("USER_DEACTIVATED");
  if (!user.password_hash || user.password_hash === "sso_no_password") {
    throw new Error("SSO_ACCOUNT_NO_PASSWORD");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new Error("ACCOUNT_LOCKED");
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    const { lockedUntil } = await registerFailedLogin(
      user.id,
      FAILED_LOGIN_LOCKOUT_THRESHOLD,
      ACCOUNT_LOCKOUT_MS,
    );
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      throw new Error("ACCOUNT_LOCKED");
    }
    throw new Error("INVALID_CREDENTIALS");
  }

  await resetFailedLogins(user.id);
  await updateLastLogin(user.id);

  return issueTokenPair(user.id, user.email, user.tenant_id, user.role as Role, "password", user.mfa_enabled);
}

/**
 * Re-issues a fully-verified token pair after a successful MFA challenge.
 * Called by POST /api/auth/mfa/{confirm,challenge} once the user has proven
 * possession of their TOTP device (or a backup code).
 */
export async function issueMfaVerifiedTokenPair(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenant_id,
    role: user.role as Role,
    authMethod: (user.auth_method ?? "password") as "password" | "sso" | "microsoft",
    mfaVerified: true,
  });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, tenantId: user.tenant_id, jti });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await storeRefreshToken(user.id, jti, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

/**
 * Called after Microsoft OIDC callback — upserts the user and issues JWT pair.
 * tenantId here refers to the AgentRadar tenant, not the Azure AD tenant.
 */
export async function loginWithMicrosoft(
  claims: MicrosoftIdTokenClaims,
  agentRadarTenantId: string | null,
) {
  const email = claims.email ?? claims.preferred_username;
  if (!email) throw new Error("MICROSOFT_EMAIL_MISSING");

  const user = await createOrLinkMicrosoftUser(
    agentRadarTenantId,
    email,
    claims.oid,
    claims.name ?? null,
  );

  // Enforce: super_admin must not use SSO for Microsoft login
  // (Microsoft SSO is configured separately for super admins via direct login only)
  // Note: the existing createOrLinkMicrosoftUser already throws SSO_SUPERADMIN_ONLY
  // if a super_admin is attempted. This is preserved from the existing behaviour.

  if (!user.is_active) throw new Error("USER_DEACTIVATED");

  await updateLastLogin(user.id);

  return issueTokenPair(
    user.id,
    user.email,
    user.tenant_id,
    user.role as Role,
    "microsoft",
  );
}

/**
 * Called after custom OIDC/SSO callback — upserts the user and issues JWT pair.
 * `resolvedRole` is derived from the IdP's security-group claims and is
 * applied on every SSO login (see roleMapping.ts / ssoCallbackHandler).
 * Super Admin is blocked from using custom SSO — they must use direct login.
 */
export async function loginWithSso(
  email: string,
  ssoId: string,
  resolvedRole: Role,
  agentRadarTenantId: string | null,
) {
  const user = await createOrLinkSsoUser(agentRadarTenantId, email, ssoId, resolvedRole);

  // Block super_admin from SSO login flow
  if (user.role === "super_admin") {
    throw new Error("SSO_SUPERADMIN_BLOCKED");
  }

  if (!user.is_active) throw new Error("USER_DEACTIVATED");

  await updateLastLogin(user.id);

  return issueTokenPair(
    user.id,
    user.email,
    user.tenant_id,
    user.role as Role,
    "sso",
  );
}

export async function refresh(rawRefreshToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(
      rawRefreshToken,
      config.jwt.refreshSecret,
    ) as RefreshTokenPayload;
  } catch {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const stored = await findValidRefreshToken(payload.jti, rawRefreshToken);
  if (!stored) {
    await revokeAllUserTokens(payload.sub);
    throw new Error("REFRESH_TOKEN_REUSE_DETECTED");
  }

  const lastUsedAt = stored.last_used_at ? new Date(stored.last_used_at) : stored.created_at;
  if (Date.now() - lastUsedAt.getTime() > IDLE_TIMEOUT_MS) {
    await revokeAllUserTokens(payload.sub);
    throw new Error("SESSION_IDLE_TIMEOUT");
  }

  await revokeRefreshToken(payload.jti);

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // Preserve the original authMethod from the stored user record
  const authMethod = (user.auth_method ?? "password") as "password" | "sso" | "microsoft";

  const pair = await issueTokenPair(
    user.id,
    user.email,
    user.tenant_id,
    user.role as Role,
    authMethod,
  );
  return pair;
}

export async function logout(userId: string) {
  await revokeAllUserTokens(userId);
  // Also invalidate any access token already issued — those are stateless
  // JWTs that would otherwise stay valid for their full 15-minute TTL.
  await invalidateTokensBefore(userId, new Date());
}

export async function getUser(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    tenantId: user.tenant_id,
    authMethod: (user.auth_method ?? "password") as "password" | "sso" | "microsoft",
    mfaEnabled: user.mfa_enabled ?? false,
    mfaEnrolled: !!user.mfa_enrolled_at,
  };
}
