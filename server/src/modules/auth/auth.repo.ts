import { db } from "../../db/client";
import crypto from "node:crypto";
import { Role } from "../../rbac/permissions";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * tenant_id is nullable — this query works correctly for both cases because
 * `tenant_id = NULL` never matches in SQL, so we branch on IS NULL explicitly
 * rather than relying on `=` comparison.
 */
export async function findUserByEmail(tenantId: string | null, email: string) {
  const res = tenantId
    ? await db.query(
        `SELECT * FROM users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, email],
      )
    : await db.query(
        `SELECT * FROM users WHERE tenant_id IS NULL AND email = $1`,
        [email],
      );
  return res.rows[0] ?? null;
}

export async function findUserById(id: string) {
  const res = await db.query(
    `SELECT id, email, role, tenant_id, auth_method, mfa_enabled, mfa_enrolled_at, is_active, name, last_login_at FROM users WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function createUser(
  tenantId: string | null,
  email: string,
  passwordHash: string,
) {
  // Super Admin accounts require MFA by default — see server/migrations/012_mfa_totp.sql.
  const res = await db.query(
    `INSERT INTO users (tenant_id, email, password_hash, role, auth_method, mfa_enabled)
     VALUES ($1, $2, $3, 'super_admin', 'password', TRUE)
     RETURNING *`,
    [tenantId, email, passwordHash],
  );
  return res.rows[0];
}

/** Find a user by their stable Azure AD Object ID (microsoft_oid). */
export async function findUserByMicrosoftOid(oid: string) {
  const res = await db.query(
    `SELECT * FROM users WHERE microsoft_oid = $1`,
    [oid],
  );
  return res.rows[0] ?? null;
}

/**
 * Upsert a Microsoft SSO user:
 * 1. If the OID is already linked → return the existing user.
 * 2. If the email already exists (password user) → link the OID and return.
 * 3. Otherwise → create a brand-new user with role 'analyst'.
 *
 * Note: super_admin users are NOT allowed to authenticate via Microsoft SSO.
 * The SSO flow in auth.service.ts enforces this after this function returns.
 */
export async function createOrLinkMicrosoftUser(
  tenantId: string | null,
  email: string,
  oid: string,
  displayName: string | null,
) {
  // Already linked?
  const byOid = await findUserByMicrosoftOid(oid);
  if (byOid) {
    if (byOid.role === "super_admin") throw new Error("SSO_SUPERADMIN_ONLY");
    return byOid;
  }

  // Existing password account with same email? Link it.
  const existing = await findUserByEmail(tenantId, email);
  if (existing) {
    if (existing.role === "super_admin") throw new Error("SSO_SUPERADMIN_ONLY");
    const res = await db.query(
      `UPDATE users SET microsoft_oid = $1, auth_method = 'microsoft', updated_at = now() WHERE id = $2 RETURNING *`,
      [oid, existing.id],
    );
    return res.rows[0];
  }

  // Brand new SSO user — create with default role 'auditor' (least privilege)
  const res = await db.query(
    `INSERT INTO users (tenant_id, email, password_hash, role, auth_method, microsoft_oid)
     VALUES ($1, $2, 'sso_no_password', 'auditor', 'microsoft', $3)
     RETURNING *`,
    [tenantId, email, oid],
  );
  return res.rows[0];
}

export async function storeRefreshToken(
  userId: string,
  tokenId: string,
  rawToken: string,
  expiresAt: Date,
) {
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, last_used_at) VALUES ($1, $2, $3, $4, now())`,
    [tokenId, userId, hashToken(rawToken), expiresAt],
  );
}

export async function findValidRefreshToken(tokenId: string, rawToken: string) {
  const res = await db.query(
    `SELECT rt.*, u.role, u.tenant_id, u.auth_method
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.id = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [tokenId],
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.token_hash !== hashToken(rawToken)) return null;
  return row;
}

export async function revokeRefreshToken(tokenId: string, replacedBy?: string) {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1`,
    [tokenId, replacedBy ?? null],
  );
}

export async function revokeAllUserTokens(userId: string) {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

/**
 * Invalidates every access token already issued to this user (they'll fail
 * requireAuth's iat check) without needing a separate token-blacklist store.
 */
export async function invalidateTokensBefore(userId: string, when: Date) {
  await db.query(
    `UPDATE users SET tokens_valid_after = $2 WHERE id = $1`,
    [userId, when],
  );
}

export async function getTokensValidAfter(userId: string): Promise<Date | null> {
  const res = await db.query(
    `SELECT tokens_valid_after FROM users WHERE id = $1`,
    [userId],
  );
  return res.rows[0]?.tokens_valid_after ?? null;
}

/**
 * Upsert a custom SSO (OIDC) user.
 * `resolvedRole` is derived from the IdP's security-group claims (see
 * roleMapping.ts) by the caller and is applied on every login — for a
 * brand-new user it becomes their initial role, for an existing user it
 * overwrites whatever role is currently stored (SSO is the source of truth
 * for group-mapped users).
 * Super Admin cannot be created or accessed via this flow.
 */
export async function createOrLinkSsoUser(
  tenantId: string | null,
  email: string,
  ssoId: string,
  resolvedRole: Role,
) {
  const existing = await findUserByEmail(tenantId, email);
  if (existing) {
    // Block super_admin from being linked via SSO
    if (existing.role === "super_admin") {
      throw new Error("SSO_SUPERADMIN_BLOCKED");
    }
    // Sync auth_method and role on every login so group changes take effect immediately
    if (existing.auth_method !== "sso" || existing.role !== resolvedRole) {
      const res = await db.query(
        `UPDATE users SET auth_method = 'sso', role = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [resolvedRole, existing.id],
      );
      return res.rows[0];
    }
    return existing;
  }

  // Brand new SSO user — role comes from the resolved group mapping
  const res = await db.query(
    `INSERT INTO users (tenant_id, email, password_hash, role, auth_method)
     VALUES ($1, $2, 'sso_no_password', $3, 'sso')
     RETURNING *`,
    [tenantId, email, resolvedRole],
  );
  return res.rows[0];
}

/** Update a user's role. Used by User Management. */
export async function updateUserRole(
  userId: string,
  role: string,
  tenantId: string | null,
) {
  const res = await db.query(
    `UPDATE users SET role = $1, updated_at = now()
     WHERE id = $2 AND (tenant_id = $3 OR ($3 IS NULL AND tenant_id IS NULL))
     RETURNING id, email, role, auth_method, mfa_enabled`,
    [role, userId, tenantId],
  );
  return res.rows[0] ?? null;
}

/** List all users in a tenant. Used by User Management. */
export async function listUsers(tenantId: string | null) {
  const res = tenantId
    ? await db.query(
        `SELECT id, email, role, auth_method, mfa_enabled, created_at
         FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId],
      )
    : await db.query(
        `SELECT id, email, role, auth_method, mfa_enabled, created_at, name, is_active, last_login_at
         FROM users WHERE tenant_id IS NULL ORDER BY created_at DESC`,
      );
  return res.rows;
}

export async function updateLastLogin(id: string) {
  await db.query(
    `UPDATE users SET last_login_at = now() WHERE id = $1`,
    [id],
  );
}

/**
 * Increments the failed-login counter for a user and, once it reaches
 * `threshold`, locks the account until `lockoutMs` from now. Returns the
 * row's post-increment state so the caller can decide what to tell the user
 * without a second round-trip.
 */
export async function registerFailedLogin(
  userId: string,
  threshold: number,
  lockoutMs: number,
): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null }> {
  const res = await db.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2 THEN now() + ($3 || ' milliseconds')::interval
           ELSE locked_until
         END
     WHERE id = $1
     RETURNING failed_login_attempts, locked_until`,
    [userId, threshold, lockoutMs],
  );
  const row = res.rows[0];
  return {
    failedLoginAttempts: row?.failed_login_attempts ?? 0,
    lockedUntil: row?.locked_until ?? null,
  };
}

/** Clears the failed-login counter and any active lockout after a successful login. */
export async function resetFailedLogins(userId: string) {
  await db.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [userId],
  );
}
